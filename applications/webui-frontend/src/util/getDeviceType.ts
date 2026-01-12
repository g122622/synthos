export enum DeviceType {
    PHONE = "PHONE",
    PAD = "PAD",
    PC = "PC"
}

// 根据UA判断设备类型
export const getDeviceType = (): DeviceType => {
    const ua = navigator.userAgent;

    // 判断是否为 iPad
    const isIpad = /iPad/i.test(ua);

    // 判断是否为 iPhone 或 iPod
    const isIphone = /iPhone|iPod/i.test(ua);

    // 判断是否为 Android
    const isAndroid = /Android/i.test(ua);

    // 判断是否为移动设备（包含 Mobile 字样）
    const isMobile = /Mobile/i.test(ua);

    // 判断是否为 Windows Phone
    const isWindowsPhone = /Windows Phone/i.test(ua);

    // 判断是否为其他移动设备
    const isOtherMobile = /BlackBerry|IEMobile|Opera Mini/i.test(ua);

    // 优先判断手机
    if (isIphone || (isAndroid && isMobile) || isWindowsPhone || isOtherMobile) {
        return DeviceType.PHONE;
    }

    // 判断平板
    if (isIpad || (isAndroid && !isMobile)) {
        return DeviceType.PAD;
    }

    // 默认为 PC
    return DeviceType.PC;
};
