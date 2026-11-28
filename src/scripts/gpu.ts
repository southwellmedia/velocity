/**
 * Whether this device can run the site's WebGL scenes (the hero sculpture
 * and the reel) at a decent frame rate.
 *
 * WebGL itself is not enough: without a real graphics chip the browser
 * falls back to drawing in software (SwiftShader, llvmpipe and the like),
 * which keeps the main thread busy on every frame. That is the case on weak
 * phones and on the machines that run Lighthouse and PageSpeed, where it
 * showed as 146 seconds of blocking time. Those devices get the still
 * instead: the hero's poster and the reel's static mode.
 *
 * `failIfMajorPerformanceCaveat` is the browser's own answer to "would this
 * context be slow?"; the renderer name catches the cases it lets through.
 * Asked once per page and remembered.
 */
let answer: boolean | undefined;

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export function canRunScenes(): boolean {
  if (answer !== undefined) return answer;
  answer = false;
  try {
    const canvas = document.createElement('canvas');
    const options = { failIfMajorPerformanceCaveat: true };
    const gl = (canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options)) as
      | WebGLRenderingContext
      | null;
    if (!gl) return answer;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    answer = !SOFTWARE.test(renderer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    answer = false;
  }
  return answer;
}
