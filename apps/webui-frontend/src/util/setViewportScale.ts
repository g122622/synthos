/**
 * Sets the viewport scale to the specified percentage.
 * @param scale - The scale to set the viewport to, in percentage.
 */
function setViewportScale(scale: number = 100): void {
    // Convert the scale from percentage to a decimal value
    const scaleDecimal = scale / 100;

    // Select the viewport meta tag
    const viewport = document.querySelector("meta[name='viewport']");

    if (viewport) {
        // Set the content attribute of the viewport meta tag
        viewport.setAttribute("content", `width=device-width, initial-scale=${scaleDecimal}, maximum-scale=${scaleDecimal}, user-scalable=no`);
    } else {
        console.error("Viewport meta tag not found.");
    }
}

export default setViewportScale;
