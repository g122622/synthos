/**
 * 会话分组组件
 */
import type { ExtendedSessionListItem } from "./types";

import React from "react";

import { SessionItem } from "./SessionItem";

interface SessionGroupProps {
    title: string;
    sessions: ExtendedSessionListItem[];
    selectedSessionId: string | null;
    editingId: string | null;
    editingTitle: string;
    onSelectSession: (id: string) => void;
    onStartEdit: (session: ExtendedSessionListItem) => void;
    onSaveEdit: (id: string) => void;
    onCancelEdit: () => void;
    onEditingTitleChange: (value: string) => void;
    onTogglePin: (id: string) => void;
    onShare: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string) => void;
}

export const SessionGroup: React.FC<SessionGroupProps> = ({
    title,
    sessions,
    selectedSessionId,
    editingId,
    editingTitle,
    onSelectSession,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onEditingTitleChange,
    onTogglePin,
    onShare,
    onExport,
    onDelete
}) => {
    if (sessions.length === 0) {
        return null;
    }

    return (
        <div className="mb-4">
            <div className="px-3 py-1 text-xs font-semibold text-default-500 uppercase">{title}</div>
            <div className="space-y-0.5">
                {sessions.map(session => (
                    <SessionItem
                        key={session.id}
                        editingTitle={editingTitle}
                        isActive={selectedSessionId === session.id}
                        isEditing={editingId === session.id}
                        session={session}
                        onCancelEdit={onCancelEdit}
                        onDelete={() => onDelete(session.id)}
                        onEditingTitleChange={onEditingTitleChange}
                        onExport={() => onExport(session.id)}
                        onSaveEdit={() => onSaveEdit(session.id)}
                        onSelect={() => onSelectSession(session.id)}
                        onShare={() => onShare(session.id)}
                        onStartEdit={() => onStartEdit(session)}
                        onTogglePin={() => onTogglePin(session.id)}
                    />
                ))}
            </div>
        </div>
    );
};
