import { Link } from "@heroui/link";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { title, subtitle } from "@/components/primitives";

import DefaultLayout from "@/layouts/default";

export default function IndexPage() {
    return (
        <DefaultLayout>
            <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
                <div className="inline-block max-w-lg text-center justify-center">
                    <h1 className={title()}>Synthos&nbsp;</h1>
                    <h1 className={title({ color: "blue" })}>AI聊天摘要系统</h1>
                    <div className={subtitle({ class: "mt-4" })}>
                        基于AI的QQ聊天记录全链路总结功能，智能分析聊天内容并生成结构化摘要报告
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 w-full max-w-6xl">
                    <Card className="max-w-full">
                        <CardHeader>
                            <h3 className="text-xl font-bold">聊天记录管理</h3>
                        </CardHeader>
                        <CardBody>
                            <p className="text-default-500">查看和筛选QQ群聊天记录，支持按时间范围和群组进行过滤</p>
                        </CardBody>
                        <CardFooter>
                            <Button as={Link} color="primary" href="/chat-messages" variant="shadow">
                                查看聊天记录
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="max-w-full">
                        <CardHeader>
                            <h3 className="text-xl font-bold">AI摘要结果</h3>
                        </CardHeader>
                        <CardBody>
                            <p className="text-default-500">浏览AI生成的聊天摘要结果，支持按会话或主题查看详细内容</p>
                        </CardBody>
                        <CardFooter>
                            <Button as={Link} color="primary" href="/ai-digest" variant="shadow">
                                查看摘要结果
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="max-w-full">
                        <CardHeader>
                            <h3 className="text-xl font-bold">🔍 智能问答</h3>
                        </CardHeader>
                        <CardBody>
                            <p className="text-default-500">基于群聊记录的语义搜索和AI问答，快速查找相关话题</p>
                        </CardBody>
                        <CardFooter>
                            <Button as={Link} color="secondary" href="/rag" variant="shadow">
                                开始问答
                            </Button>
                        </CardFooter>
                    </Card>

                    <Card className="max-w-full">
                        <CardHeader>
                            <h3 className="text-xl font-bold">群组管理</h3>
                        </CardHeader>
                        <CardBody>
                            <p className="text-default-500">管理QQ群组配置信息，查看群组AI模型设置和分组策略</p>
                        </CardBody>
                        <CardFooter>
                            <Button as={Link} color="primary" href="/groups" variant="shadow">
                                管理群组
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="mt-12 text-center max-w-3xl">
                    <h2 className="text-2xl font-bold mb-4">系统特性</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-default-100 p-4 rounded-lg">
                            <h3 className="font-semibold text-lg mb-2">智能分析</h3>
                            <p className="text-default-600">利用先进的AI模型自动分析聊天内容，识别关键主题和要点</p>
                        </div>
                        <div className="bg-default-100 p-4 rounded-lg">
                            <h3 className="font-semibold text-lg mb-2">多维度筛选</h3>
                            <p className="text-default-600">支持按时间、群组、会话等多种维度筛选和查看聊天记录</p>
                        </div>
                        <div className="bg-default-100 p-4 rounded-lg">
                            <h3 className="font-semibold text-lg mb-2">结构化摘要</h3>
                            <p className="text-default-600">
                                将非结构化的聊天内容转换为结构化的摘要报告，便于理解和存档
                            </p>
                        </div>
                        <div className="bg-default-100 p-4 rounded-lg">
                            <h3 className="font-semibold text-lg mb-2">导出功能</h3>
                            <p className="text-default-600">支持将摘要结果导出为多种格式，方便分享和进一步处理</p>
                        </div>
                    </div>
                </div>
            </section>
        </DefaultLayout>
    );
}
