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
    onStartEdit: (e: React.MouseEvent, session: ExtendedSessionListItem) => void;
    onSaveEdit: (e: React.MouseEvent, id: string) => void;
    onCancelEdit: () => void;
    onEditingTitleChange: (value: string) => void;
    onTogglePin: (e: React.MouseEvent, id: string) => void;
    onShare: (e: React.MouseEvent, id: string) => void;
    onExport: (e: React.MouseEvent, id: string) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
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
                        onDelete={e => onDelete(e, session.id)}
                        onEditingTitleChange={onEditingTitleChange}
                        onExport={e => onExport(e, session.id)}
                        onSaveEdit={e => onSaveEdit(e, session.id)}
                        onSelect={() => onSelectSession(session.id)}
                        onShare={e => onShare(e, session.id)}
                        onStartEdit={e => onStartEdit(e, session)}
                        onTogglePin={e => onTogglePin(e, session.id)}
                    />
                ))}
            </div>
        </div>
    );
};
