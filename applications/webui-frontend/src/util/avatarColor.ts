/**
 * 头像主色采样与贡献者 Chip 配色
 *
 * 设计要点：
 * - 头像走同源后端代理（/api/qq-avatar），画进 canvas 不会被跨域污染，getImageData 可读。
 * - 采样是异步的（需加载头像 → 画 canvas → 读像素），而 Chip 是同步 inline style：
 *   首帧用 AVATAR_FALLBACK_COLORS 兜底，采样完成后由订阅者（useAvatarColor）触发重渲染切换。
 * - 按 qqId 在模块作用域缓存 + in-flight 去重，全应用同一头像只采样一次。
 */

/** 固定配色盘（从原 utils.ts 的 colors 数组搬来），采样结果映射到其中最近的一色 */
export const AVATAR_COLORS: readonly string[] = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#98D8C8", "#FFD700", "#F8B500", "#6C5CE7"];

/** Chip 配色对：背景带 20% alpha，前景实色（沿用旧 generateColorFromName 的约定） */
export type ChipColorPair = {
    backgroundColor: string;
    color: string;
};

/** 兜底配色：中性灰。无/非法 QQ 号或采样失败时使用 */
export const AVATAR_FALLBACK_COLORS: ChipColorPair = {
    backgroundColor: "#9CA3AF20",
    color: "#6B7280"
};

// ==================== 内部状态 ====================

/** 已解析的配色缓存：qqId → ChipColorPair（含失败时写入的兜底值） */
const cache = new Map<string, ChipColorPair>();
/** in-flight 去重：qqId → 进行中的采样 Promise */
const inflight = new Map<string, Promise<ChipColorPair>>();
/** 订阅者：qqId → 回调集合（resolve 或 reject 都会通知，便于订阅者切换为兜底/真实色） */
const listeners = new Map<string, Set<() => void>>();

/** 预计算调色盘的 RGB 分量，避免每次采样重复解析 hex */
const PALETTE_RGB = AVATAR_COLORS.map(hexToRgb);

// ==================== 对外 API ====================

/**
 * 同步访问某 qqId 的 Chip 配色。
 * - 命中缓存 → 返回缓存值
 * - 未命中 → 返回兜底，并副作用启动采样（首帧渲染触发，后续渲染读缓存）
 */
export function getAvatarColorPair(qqId: string): ChipColorPair {
    const cached = cache.get(qqId);

    if (cached) {
        return cached;
    }

    // 副作用：若无在途请求则启动采样（去重由 sampleAvatarColor 内部保证）
    if (!inflight.has(qqId)) {
        void sampleAvatarColor(qqId);
    }

    return AVATAR_FALLBACK_COLORS;
}

/**
 * 订阅某 qqId 的采样完成（成功或失败均触发）。返回取消订阅函数。
 */
export function subscribeAvatarColor(qqId: string, cb: () => void): () => void {
    let set = listeners.get(qqId);

    if (!set) {
        set = new Set();
        listeners.set(qqId, set);
    }
    set.add(cb);

    return () => {
        const current = listeners.get(qqId);

        if (current) {
            current.delete(cb);
            if (current.size === 0) {
                listeners.delete(qqId);
            }
        }
    };
}

/**
 * 采样头像主色（核心异步函数，也 export 便于测试）。
 * 缓存命中直接返回；in-flight 命中共享 promise；否则执行采样并在 settle 后写缓存、通知订阅者。
 */
export function sampleAvatarColor(qqId: string): Promise<ChipColorPair> {
    const cached = cache.get(qqId);

    if (cached) {
        return Promise.resolve(cached);
    }

    const existing = inflight.get(qqId);

    if (existing) {
        return existing;
    }

    const promise = sampleAvatarColorUncached(qqId)
        .then(result => {
            cache.set(qqId, result);

            return result;
        })
        .catch(() => {
            // 采样失败：写兜底进缓存，避免反复重试；订阅者重渲染后即为兜底色
            cache.set(qqId, AVATAR_FALLBACK_COLORS);

            return AVATAR_FALLBACK_COLORS;
        })
        .finally(() => {
            inflight.delete(qqId);
            notify(qqId);
        });

    inflight.set(qqId, promise);

    return promise;
}

// ==================== 采样实现 ====================

/**
 * 实际执行采样（无缓存）。失败抛错，由调用方兜底。
 *
 * 算法：用独立的 new Image() 打真实头像 URL（绝不采样可见 <QQAvatar> 的 img，
 * 后者可能已 onError 换成占位 SVG），画进 10×10 canvas（恰好 100 像素 = 100 采样点，
 * drawImage 的 imageSmoothing 会把每个 10×10 源块平均成 1 像素，免去逐像素循环），
 * 跳过透明像素后取 RGB 平均，映射到调色盘最近色。
 */
async function sampleAvatarColorUncached(qqId: string): Promise<ChipColorPair> {
    const url = `/api/qq-avatar?type=user&qqId=${encodeURIComponent(qqId)}`;
    const img = await loadImage(url);

    // 10×10 = 100 采样点
    const canvas = document.createElement("canvas");

    canvas.width = 10;
    canvas.height = 10;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("无法获取 2D canvas 上下文");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, 10, 10);

    let data: Uint8ClampedArray;

    try {
        data = ctx.getImageData(0, 0, 10, 10).data;
    } catch {
        // SecurityError（ tainted canvas）；同源不会发生，防御性兜底
        throw new Error("getImageData 被拒绝（画布可能被污染）");
    }

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let i = 0; i < 100; i++) {
        const offset = i * 4;
        const alpha = data[offset + 3];

        // 跳过透明像素（圆角 / 透明边）
        if (alpha < 128) {
            continue;
        }
        rSum += data[offset];
        gSum += data[offset + 1];
        bSum += data[offset + 2];
        count++;
    }

    if (count === 0) {
        throw new Error("头像全透明，无法采样");
    }

    const avg = {
        r: Math.round(rSum / count),
        g: Math.round(gSum / count),
        b: Math.round(bSum / count)
    };

    const nearest = nearestColorInPalette(avg);

    return { backgroundColor: nearest + "20", color: nearest };
}

/** 加载图片，onload resolve / onerror reject */
function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        // 同源后端代理，无需 crossOrigin；加了反而可能触发额外的 OPTIONS/凭据问题
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`头像加载失败: ${url}`));
        img.src = url;
    });
}

/** 在调色盘中找 RGB 欧氏距离最近的色（用平方距离做 argmin，省去开方） */
function nearestColorInPalette(rgb: { r: number; g: number; b: number }): string {
    let bestIndex = 0;
    let bestDist = Infinity;

    for (let i = 0; i < PALETTE_RGB.length; i++) {
        const p = PALETTE_RGB[i];
        const dr = rgb.r - p.r;
        const dg = rgb.g - p.g;
        const db = rgb.b - p.b;
        const dist = dr * dr + dg * dg + db * db;

        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = i;
        }
    }

    return AVATAR_COLORS[bestIndex];
}

/** 通知某 qqId 的所有订阅者 */
function notify(qqId: string): void {
    const set = listeners.get(qqId);

    if (!set) {
        return;
    }
    // 复制一份再遍历，避免回调里取消订阅导致遍历过程中集合变动
    for (const cb of [...set]) {
        cb();
    }
}

/** hex (#RRGGBB) → {r,g,b} */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const value = hex.startsWith("#") ? hex.slice(1) : hex;

    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16)
    };
}
