import { addToast } from "@heroui/react";

interface NotificationOptions {
    title: string;
    description?: string;
}

export const Notification = {
    success(options: NotificationOptions) {
        addToast({
            title: options.title,
            description: options.description,
            color: "success",
            variant: "flat",
            shouldShowTimeoutProgress: true
        });
    },

    error(options: NotificationOptions) {
        addToast({
            title: options.title,
            description: options.description,
            color: "danger",
            variant: "flat",
            shouldShowTimeoutProgress: true
        });
    }
};
