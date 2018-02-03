const createMedia = async (src) => {
  try{
    return await createImage(src);
  }
  catch(e){
    const video = document.createElement('video');
    video.crossOrigin = "";
    video.src = src;  
    return video;
  }
};

const createImage = async (src) => new Promise((resolve, reject) => {
  const image = new Image;
  image.crossOrigin = "";
  image.onload = () => {
    resolve(image);
  };
  image.onerror = reject;
  image.src = src;
});


(async () => {
  const vertexShader = `
  attribute vec3 position;
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
  `;

  const params = {
    startTime: Date.now(),
    time: 0,
    width: 0,
    height: 0,
    textureWidth: 0,
    textureHeight: 0
  };

  const checkTextureReady = (video) => {
    if(params.videoPlaying && params.videoTimeUpdate || video.readyState > 3){
      params.textureReady = true;
    }
  };

  const updateTexture = (gl, texture, image) => {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, image);
    };

  const uniformLocation = {
    time: 0,
    resolution: 0,
    texture: 0,
    textureSize: 0
  };

  const canvas = document.createElement(`canvas`);
  document.body.appendChild(canvas);

  const gl = canvas.getContext(`webgl2`);

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

    params.width = canvas.width;
    params.height = canvas.height;

    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const loadTexture = (domElement) => {
    if(domElement instanceof Image){
      return loadTextureImage(domElement);
    }
    if(domElement instanceof HTMLVideoElement){
      return loadTextureVideo(domElement);
    }
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

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,  vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,1,-1,1,1,1,1,-1,1,1]), gl.STATIC_DRAW);

  let shader, texture, textureSrc;

  const init = async () => {
    console.log("init");
    const program = document.getElementById('fs').value;
    const fragmentShader = program.split('\n').slice(1).join('\n');
    const src = program.split('\n')[0].slice(1)
    console.log(src);
    console.log(fragmentShader);

    shader = createProgram(vertexShader, fragmentShader);

    textureSrc = await createMedia(src);
    texture = createTexture();
    console.log("initend");
    params.startTime = Date.now();

    history.replaceState(undefined, undefined, "#" + program)
  };
  await init();

  document.getElementById('fs').onkeydown = init;
  document.getElementById('fs').onkeypress = init;
  document.getElementById('fs').onkeyup = init;

  const render = () => {
    params.time = Date.now() - params.startTime;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shader);

    gl.uniform1f(gl.getUniformLocation(shader, 'time'), params.time / 1000);
    gl.uniform2f(gl.getUniformLocation(shader, 'resolution'), params.width, params.height);
    gl.uniform2f(gl.getUniformLocation(shader, 'textureSize'), params.textureWidth, params.textureHeight);

    let vertex_position;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vertex_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertex_position);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(gl.getUniformLocation(shader, 'texture'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(vertex_position);
  };

  const loop = () => {
    handleResize();
    updateTexture(gl, texture, textureSrc);
    render();
    requestAnimationFrame(loop);
  };

  loop();
})();