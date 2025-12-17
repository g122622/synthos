const handler = (event: { preventDefault: () => void; returnValue: string }) => {
    // Cancel the event as stated by the standard.
    event.preventDefault();
    // Chrome requires returnValue to be set.
    event.returnValue = "";
};

let isPrevented = false;

export function preventPageClose() {
    if (!isPrevented) {
        window.addEventListener("beforeunload", handler);
        isPrevented = true;
    }
}

export function allowPageClose() {
    if (isPrevented) {
        window.removeEventListener("beforeunload", handler);
        isPrevented = false;
    }
}
