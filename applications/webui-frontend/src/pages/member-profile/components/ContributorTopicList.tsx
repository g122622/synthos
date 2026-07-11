import type React from "react";
import type { AIDigestResult } from "@/types/topic";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { MessageSquare } from "lucide-react";

import TopicCard from "@/components/topic/TopicCard";

interface ContributorTopicListProps {
    topics: AIDigestResult[];
    loading: boolean;
}

/**
 * 画像依据话题列表
 * 复用 TopicCard 展示该群友参与的所有话题摘要
 */
const ContributorTopicList: React.FC<ContributorTopicListProps> = ({ topics, loading }) => {
    return (
        <Card className="border border-default-200">
            <CardHeader className="flex flex-row items-center gap-2">
                <MessageSquare size={18} />
                <h3 className="text-lg font-bold">画像依据话题</h3>
                <Chip color="primary" size="sm" variant="flat">
                    共 {topics.length} 个
                </Chip>
            </CardHeader>
            <CardBody>
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <Spinner size="md" />
                    </div>
                ) : topics.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {topics.map((topic, idx) => (
                            <TopicCard key={topic.topicId} index={idx + 1} topic={topic} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-default-500">该群友暂无已摘要话题</p>
                    </div>
                )}
            </CardBody>
        </Card>
    );
};

export default ContributorTopicList;
