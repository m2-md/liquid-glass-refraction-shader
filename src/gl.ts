// gl.ts — derleme/link yardımcıları. WebGL nesneleri null dönebilir; strict
// altında her biri kontrol edilip anlamlı hata fırlatılıyor.

/** Shader derleme hatasını satır numarasıyla okunur hâle getirir. */
export function annotateSource(source: string): string {
  return source
    .split("\n")
    .map((line, i) => `${String(i + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader başarısız");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "(log yok)";
    gl.deleteShader(shader);
    throw new Error(`Shader derlenmedi:\n${log}\n${annotateSource(source)}`);
  }
  return shader;
}

export function linkProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram başarısız");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "(log yok)";
    gl.deleteProgram(program);
    throw new Error(`Program linklenmedi:\n${log}`);
  }
  return program;
}

export type UniformMap = Record<string, WebGLUniformLocation>;

/** Aktif uniform'ların tamamını isim → konum tablosuna çevirir. */
export function collectUniforms(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): UniformMap {
  const total = gl.getProgramParameter(
    program,
    gl.ACTIVE_UNIFORMS,
  ) as unknown as number;
  const map: UniformMap = {};
  for (let i = 0; i < total; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    const location = gl.getUniformLocation(program, name);
    if (location) map[name] = location;
  }
  return map;
}

/**
 * WebGL2 çizim için bağlı bir VAO ister, ama panelin ve tam ekran üçgeninin
 * hiç attribute'u yok: boş bir VAO yetiyor.
 */
export function createGlassGeometry(
  gl: WebGL2RenderingContext,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("createVertexArray başarısız");
  return vao;
}
