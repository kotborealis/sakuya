// Initialize GL context
const canvas = document.createElement(`canvas`);
document.body.appendChild(canvas);
const gl = canvas.getContext(`webgl2`);

// Create elements for video and image
const domElementVideo = document.createElement(`video`);
domElementVideo.crossOrigin = "";
domElementVideo.autoplay = true;
domElementVideo.loop = true;

const domElementImage = new Image;
domElementImage.crossOrigin = "";
document.body.appendChild(domElementImage);


// Functions to init video/image
// with some url
const initMedia = (src) => {
  initImage(src).catch(() => initVideo(src));
}

const initImage = (src) => new Promise((resolve, reject) => {
  domElementImage.src = src;
  domElementImage.onerror = reject;
  state.textureSource = domElementImage;
});

const initVideo = (src) => {
  domElementVideo.src = src;
  state.textureSource = domElementVideo;
}


const vertexShader = `
attribute vec3 position;
void main(){
  gl_Position = vec4(position, 1.0);
}`;

// Application state
const state = {
  startTime: Date.now(),
  time: 0,
  width: 0,
  height: 0,
  textureWidth: 0,
  textureHeight: 0,
  shader: null,
  texture: null,
  textureSource: null
};

const updateTexture = () => {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.bindTexture(gl.TEXTURE_2D, state.texture);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                srcFormat, srcType, state.textureSource);
};

const createShader = (src, type) => {
  const shader = gl.createShader(type);

  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
    const type_str = (type == gl.VERTEX_SHADER ? `VERTEX` : `FRAGMENT`);
    throw new Error(`${type_str} + SHADER: ${gl.getShaderInfoLog(shader)}`);
  }

  return shader;
}

const createProgram = (vertex, fragment) => {
  const program = gl.createProgram();
  const vs = createShader(vertex, gl.VERTEX_SHADER);
  const fs = createShader('#ifdef GL_ES\nprecision highp float;\n#endif\n\n' + fragment, gl.FRAGMENT_SHADER);

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);

  gl.deleteShader(vs);
  gl.deleteShader(fs);

  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)){
    throw new Error(`PROGRAM ERROR:
      VALIDATE_STATUS: ${gl.getProgramParameter(program, gl.VALIDATE_STATUS)}
      ERROR: ${gl.getError()}`);
  }

  return program;
};

const handleResize = () => {
  if (canvas.width == canvas.clientWidth && canvas.height == canvas.clientHeight){
    return;
  }

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  state.width = canvas.width;
  state.height = canvas.height;

  gl.viewport(0, 0, canvas.width, canvas.height);
};

const createTexture = () => {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);

  return texture;
};

// Fill vertex buffer
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,  vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);

// Fill UV buffer
const uvBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,1,-1,1,1,1,1,-1,1,1]), gl.STATIC_DRAW);

const render = () => {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(state.shader);

  gl.uniform1f(gl.getUniformLocation(state.shader, 'time'), state.time / 1000);
  gl.uniform2f(gl.getUniformLocation(state.shader, 'resolution'), state.width, state.height);
  gl.uniform2f(gl.getUniformLocation(state.shader, 'textureSize'), state.textureWidth, state.textureHeight);

  let vertex_position;
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(vertex_position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vertex_position);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, state.texture);
  gl.uniform1i(gl.getUniformLocation(state.shader, 'texture'), 0);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.disableVertexAttribArray(vertex_position);
};

const loop = () => {
  state.time = Date.now() - state.startTime;
  handleResize();
  updateTexture();
  render();
  requestAnimationFrame(loop);
};

state.texture = createTexture();

const init = () => {
  const program = document.getElementById('fs').value;

  const fragmentShader = program.split('\n').slice(1).join('\n');
  const mediaSrc = program.split('\n')[0];

  state.shader = createProgram(vertexShader, fragmentShader);
  initMedia(mediaSrc);

  state.startTime = Date.now();
};

init();
loop();

document.getElementById('fs').addEventListener('input', init);