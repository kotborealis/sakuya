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
    textureHeight: 0,

    animated_texture: false,
    videoPlaying: false,
    videoTimeUpdate: false,
    textureReady: false
  };

  const checkTextureReady = (video) => {
    if(params.videoPlaying && params.videoTimeUpdate || video.readyState > 3){
      params.textureReady = true;
    }
  };

  const updateTextureVideo = (gl, texture, video) => {
      const level = 0;
      const internalFormat = gl.RGBA;
      const srcFormat = gl.RGBA;
      const srcType = gl.UNSIGNED_BYTE;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, video);
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

  const createTexture = (image = null) => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    if(image){
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      params.textureWidth = image.width;
      params.textureHeight = image.height;
    }
    else{
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

      params.animated_texture = true;
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if(image){
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
  };

  const loadTextureImage = async (image) => new Promise((resolve, reject) => {
    image.onload = () => {
      resolve(createTexture(image));   
    };
  });

  const loadTextureVideo = (video) => {
    video.addEventListener('playing', () => {
      params.videoPlaying = true;
      checkTextureReady(video);
    });
    video.addEventListener('timeupdate', () => {
      params.videoTimeUpdate = true;
      checkTextureReady(video);
    });
    checkTextureReady(video);
    return createTexture();
  }

  const generateShaderUniformLocation = (uniformLocation, program) => {
    Object.keys(uniformLocation).map(name => 
      uniformLocation[name] = gl.getUniformLocation(program, name)
    );
  };

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,  vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,-1,1,1,-1,1]), gl.STATIC_DRAW);

  const uvBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,1,-1,1,1,1,1,-1,1,1]), gl.STATIC_DRAW);

  let shader, texture, textureSrc;

  const init = async () => {
    const fragmentShader = document.getElementById('fs').textContent;
    shader = createProgram(vertexShader, fragmentShader);
    textureSrc = document.getElementById("texture");
    texture = await loadTexture(textureSrc);
    
    generateShaderUniformLocation(uniformLocation, shader);

    params.startTime = Date.now();
  };

  await init();

  document.onkeypress = init;

  const render = () => {
    params.time = Date.now() - params.startTime;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shader);

    gl.uniform1f(uniformLocation.time, params.time / 1000);
    gl.uniform2f(uniformLocation.resolution, params.width, params.height);
    gl.uniform2f(uniformLocation.textureSize, params.textureWidth, params.textureHeight);

    let vertex_position;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(vertex_position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vertex_position);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniformLocation.texture, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(vertex_position);
  };

  const loop = () => {
    handleResize();
    if(params.animated_texture){
      updateTextureVideo(gl, texture, textureSrc);
    }
    render();
    requestAnimationFrame(loop);
  };

  loop();
})();