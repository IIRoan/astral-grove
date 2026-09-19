import { setConsoleFunction } from 'three';

const QUIET =
  /Clock: This module has been deprecated|EXT_color_buffer_float extension not supported|EXT_color_buffer_half_float extension not supported/;

let installed = false;

/** R3F still constructs THREE.Clock; Expo GL lacks float color buffers + some pixelStorei params. */
export function silenceThreeExpoNoise() {
  if (installed) return;
  installed = true;
  setConsoleFunction((type, message, ...params) => {
    if (type === 'warn' && typeof message === 'string' && QUIET.test(message)) return;
    (console[type] ?? console.log)(message, ...params);
  });
}

/** Expo GL only implements UNPACK_FLIP_Y_WEBGL; other pixelStorei calls spam the console. */
export function patchExpoGlPixelStore(gl: WebGLRenderingContext) {
  const pixelStorei = gl.pixelStorei.bind(gl);
  gl.pixelStorei = ((pname: number, param: number) => {
    if (pname === gl.UNPACK_FLIP_Y_WEBGL) pixelStorei(pname, param);
  }) as typeof gl.pixelStorei;
}
