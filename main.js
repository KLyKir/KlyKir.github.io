"use strict";

let gl; // The webgl context.
let surface; // A surface model
let shProgram; // A shader program
let spaceball; // A SimpleRotator object that lets the user rotate the view by mouse.
let texture0;
let cameraText;
let video;
let BG;
let orient = null;

let orientationEvent = { alpha: 0, beta: 0, gamma: 0 };

// Constructor
function Model(name) {
  this.name = name;
  this.iVertexBuffer = gl.createBuffer();
  this.iTextureBuffer = gl.createBuffer();
  this.count = 0;

  this.BufferData = function (vertices, textureList) {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(textureList),
      gl.STREAM_DRAW
    );

    gl.enableVertexAttribArray(shProgram.itextureCoords);
    gl.vertexAttribPointer(shProgram.itextureCoords, 2, gl.FLOAT, false, 0, 0);

    this.count = vertices.length / 3;
  };

  this.Draw = function () {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.iVertexBuffer);
    gl.vertexAttribPointer(shProgram.iAttribVertex, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.iAttribVertex);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.iTextureBuffer);
    gl.vertexAttribPointer(shProgram.itextureCoords, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(shProgram.itextureCoords);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  };
}

// Constructor
function ShaderProgram(name, program) {
  this.name = name;
  this.prog = program;

  this.iAttribVertex = -1;
  this.itextureCoords = -1;
  this.iTextUnit = -1;

  this.Use = function () {
    gl.useProgram(this.prog);
  };
}

/* Draws a colored cube, along with a set of coordinate axes.
 * (Note that the use of the above drawPrimitive function is not an efficient
 * way to draw with WebGL.  Here, the geometry is so simple that it doesn't matter.)
 */
function draw() {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const eyeSeparation = parseFloat(
    document.getElementById("eyeSeparation").value
  );
  const convergence = parseFloat(document.getElementById("convergence").value);
  const fieldOfViev = parseFloat(document.getElementById("fieldOfViev").value);
  const near = parseFloat(document.getElementById("near").value);

  let top = 2000;
  let bottom = 2000;
  let left = 2000;
  let right = 2000;
  let far = 2000;

  top = near * Math.tan(fieldOfViev / 2.0);
  bottom = -top;

  let a = Math.tan(fieldOfViev / 2.0) * convergence;
  let b = a - eyeSeparation / 2;
  let c = a + eyeSeparation / 2;

  left = (-b * near) / convergence;
  right = (c * near) / convergence;

  let leftP = m4.orthographic(left, right, bottom, top, near, far);

  left = (-c * near) / convergence;
  right = (b * near) / convergence;

  let rightP = m4.orthographic(left, right, bottom, top, near, far);

  /* Get the view matrix from the SimpleRotator object.*/
  let modelView = spaceball.getViewMatrix();

  if (
    orientationEvent.alpha &&
    orientationEvent.beta &&
    orientationEvent.gamma
  ) {
    let alpha = orientationEvent.alpha * (Math.PI / 180);
    let beta = orientationEvent.beta * (Math.PI / 180);
    let gamma = orientationEvent.gamma * (Math.PI / 180);

    let rotationMatZ = m4.axisRotation([0, 0, 1], alpha);
    let rotationMatX = m4.axisRotation([1, 0, 0], -beta);
    let rotationMayY = m4.axisRotation([0, 1, 0], gamma);

    let rotationMatrix = m4.multiply(
      m4.multiply(rotationMatX, rotationMayY),
      rotationMatZ
    );
    let translationMatrix = m4.translation(0, 0, -2);

    modelView = m4.multiply(rotationMatrix, translationMatrix);
  }

  let rotateToPointZero = m4.axisRotation([0.707, 0.707, 0], 0);

  let leftTrans = m4.translation(-0.01, 0, -20);
  let rightTrans = m4.translation(0.01, 0, -20);

  let matrixMult = m4.multiply(rotateToPointZero, modelView);

  if (document.getElementById("camera").checked) {
    const projection = m4.orthographic(0, 1, 0, 1, -1, 1);
    const noRot = m4.multiply(
      rotateToPointZero,
      [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    );

    gl.uniformMatrix4fv(shProgram.iModelViewMat, false, noRot);
    gl.uniformMatrix4fv(shProgram.iProjectionMat, false, projection);

    gl.bindTexture(gl.TEXTURE_2D, cameraText);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    BG?.Draw();
  }

  gl.bindTexture(gl.TEXTURE_2D, texture0);

  gl.clear(gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(
    shProgram.iModelViewMat,
    false,
    m4.multiply(leftTrans, matrixMult)
  );
  gl.uniformMatrix4fv(shProgram.iProjectionMat, false, leftP);

  gl.colorMask(true, false, false, false);

  surface.Draw();

  gl.clear(gl.DEPTH_BUFFER_BIT);

  gl.uniformMatrix4fv(
    shProgram.iModelViewMat,
    false,
    m4.multiply(rightTrans, matrixMult)
  );
  gl.uniformMatrix4fv(shProgram.iProjectionMat, false, rightP);

  gl.colorMask(false, true, true, false);

  surface.Draw();

  gl.colorMask(true, true, true, true);
}

let a = 0.5;
let b = 10;
let c = 0.5;

const step = (max, splines = 20) => {
  return max / (splines - 1);
};

const cos = (x) => {
  return Math.cos(x);
};

const sin = (x) => {
  return Math.sin(x);
};

function CreateSurfaceData() {
  let vertexList = [];

  let u = 0;
  let v = 0;
  let uMax = Math.PI * 2;
  let vMax = Math.PI * 2;
  let uStep = uMax / 50;
  let vStep = vMax / 50;

  for (let u = 0; u <= uMax; u += uStep) {
    for (let v = 0; v <= vMax; v += vStep) {
      let vert = HelicoidSurface(u, v);
      let avert = HelicoidSurface(u + uStep, v);
      let bvert = HelicoidSurface(u, v + vStep);
      let cvert = HelicoidSurface(u + uStep, v + vStep);

      vertexList.push(vert.x, vert.y, vert.z);
      vertexList.push(avert.x, avert.y, avert.z);
      vertexList.push(bvert.x, bvert.y, bvert.z);

      vertexList.push(avert.x, avert.y, avert.z);
      vertexList.push(cvert.x, cvert.y, cvert.z);
      vertexList.push(bvert.x, bvert.y, bvert.z);
    }
  }
  let normals = [];

  for (let u = 0; u <= uMax; u += uStep) {
    for (let v = 0; v <= vMax; v += vStep) {
      let vert = HelicoidSurface(u, v);
      let avert = HelicoidSurface(u + uStep, v);
      let bvert = HelicoidSurface(u, v + vStep);
      let cvert = HelicoidSurface(u + uStep, v + vStep);
      let verta0 = {
        x: avert.x - vert.x,
        y: avert.y - vert.y,
        z: avert.z - vert.z,
      };
      let vertb0 = {
        x: bvert.x - vert.x,
        y: bvert.y - vert.y,
        z: bvert.z - vert.z,
      };
      let vertca = {
        x: cvert.x - avert.x,
        y: cvert.y - avert.y,
        z: cvert.z - avert.z,
      };
      let vertba = {
        x: bvert.x - avert.x,
        y: bvert.y - avert.y,
        z: bvert.z - avert.z,
      };
      let norm = vec3Cross(verta0, vertb0);
      vec3Normalize(norm);
      let norma = vec3Cross(vertca, vertba);
      vec3Normalize(norma);
      normals.push(norm.x, norm.y, norm.z);
      normals.push(norm.x, norm.y, norm.z);
      normals.push(norm.x, norm.y, norm.z);
      normals.push(norma.x, norma.y, norma.z);
      normals.push(norma.x, norma.y, norma.z);
      normals.push(norma.x, norma.y, norma.z);
    }
  }

  return { vertexList, textureList: normals };
}

function vec3Cross(a, b) {
  let x = a.y * b.z - b.y * a.z;
  let y = a.z * b.x - b.z * a.x;
  let z = a.x * b.y - b.x * a.y;
  return { x: x, y: y, z: z };
}

function vec3Normalize(a) {
  var mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
  a.x /= mag;
  a.y /= mag;
  a.z /= mag;
}
c = 0.5;
function HelicoidSurface(u, v) {
  const a = 1;
  const b = c / Math.PI;
  const t = Math.PI / 2;
  let x = (a + x0(v) * Math.cos(t) + y0(v) * Math.sin(t)) * Math.cos(u);
  let y = (a + x0(v) * Math.cos(t) + y0(v) * Math.sin(t)) * Math.sin(u);
  let z = b * u - x0(v) * Math.sin(t) + y0(v) * Math.cos(t);

  return { x: x, y: y, z: z };
}

function x0(v) {
  return c * Math.pow(Math.cos(v), 3);
}

function y0(v) {
  return c * Math.pow(Math.sin(v), 3);
}
/* Initialize the WebGL context. Called from init() */
function initGL() {
  let prog = createProgram(gl, vertexShaderSource, fragmentShaderSource);

  shProgram = new ShaderProgram("Basic", prog);
  shProgram.Use();

  shProgram.iAttribVertex = gl.getAttribLocation(prog, "vertex");
  shProgram.iModelViewMat = gl.getUniformLocation(prog, "ModelViewMatrix");
  shProgram.iProjectionMat = gl.getUniformLocation(prog, "ProjectionMatrix");

  shProgram.itextureCoords = gl.getAttribLocation(prog, "textureCoords");
  shProgram.iTextUnit = gl.getUniformLocation(prog, "textureU");

  surface = new Model("Surface");
  BG = new Model("Background");
  const { vertexList, textureList } = CreateSurfaceData();
  surface.BufferData(vertexList, textureList);
  BG.BufferData(
    [
      0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0,
      0.0, 0.0, 0.0,
    ],
    [1, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1]
  );

  LoadTexture();
  gl.enable(gl.DEPTH_TEST);
}

/* Creates a program for use in the WebGL context gl, and returns the
 * identifier for that program.  If an error occurs while compiling or
 * linking the program, an exception of type Error is thrown.  The error
 * string contains the compilation or linking error.  If no error occurs,
 * the program identifier is the return value of the function.
 * The second and third parameters are strings that contain the
 * source code for the vertex shader and for the fragment shader.
 */
function createProgram(gl, vShader, fShader) {
  let vsh = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vsh, vShader);
  gl.compileShader(vsh);
  if (!gl.getShaderParameter(vsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in vertex shader:  " + gl.getShaderInfoLog(vsh));
  }
  let fsh = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fsh, fShader);
  gl.compileShader(fsh);
  if (!gl.getShaderParameter(fsh, gl.COMPILE_STATUS)) {
    throw new Error("Error in fragment shader:  " + gl.getShaderInfoLog(fsh));
  }
  let prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Link error in program:  " + gl.getProgramInfoLog(prog));
  }
  return prog;
}

const rerender = () => {
  draw();
  window.requestAnimationFrame(rerender);
};

/**
 * initialization function that will be called when the page has loaded
 */
function init() {
  let canvas;
  try {
    canvas = document.getElementById("webglcanvas");
    gl = canvas.getContext("webgl");

    video = document.createElement("video");
    video.setAttribute("autoplay", "true");
    cameraText = getCameraText(gl);

    document.getElementById("camera").addEventListener("change", async (e) => {
      if (document.getElementById("camera").checked) {
        getCamera().then((stream) => (video.srcObject = stream));
      } else {
        video.srcObject = null;
      }
    });

    if (!gl) {
      throw "Browser does not support WebGL";
    }
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not get a WebGL graphics context.</p>";
    return;
  }
  try {
    initGL(); // initialize the WebGL graphics context
  } catch (e) {
    document.getElementById("canvas-holder").innerHTML =
      "<p>Sorry, could not initialize the WebGL graphics context: " +
      e +
      "</p>";
    return;
  }

  spaceball = new TrackballRotator(canvas, draw, 0);

  document.getElementById("eyeSeparation").addEventListener("input", draw);
  document.getElementById("convergence").addEventListener("input", draw);
  document.getElementById("fieldOfViev").addEventListener("input", draw);
  document.getElementById("near").addEventListener("input", draw);

  document
    .getElementById("orientation")
    .addEventListener("change", async () => {
      if (document.getElementById("orientation").checked) {
        startDeviceOrientation();
      }
    });

  rerender();
}

const LoadTexture = () => {
  const image = new Image();
  image.src =
    "https://www.the3rdsequence.com/texturedb/download/116/texture/jpg/1024/irregular+wood+planks-1024x1024.jpg";
  image.crossOrigin = "anonymous";

  image.addEventListener("load", () => {
    texture0 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  });
};

const getCamera = () =>
  new Promise((resolve) =>
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((s) => resolve(s))
  );

const getCameraText = (gl) => {
  const text = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, text);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  return text;
};

const startDeviceOrientation = async () => {
  if (
    typeof DeviceOrientationEvent?.requestPermission !== "function" ||
    typeof DeviceOrientationEvent === "undefined"
  )
    throw new Error("DeviceOrientationEvent === undefined");

  try {
    const permission = await DeviceOrientationEvent.requestPermission();
    if (permission === "granted") {
      orient = (event) => {
        const { alpha, beta, gamma } = event;
        orientationEvent.alpha = alpha;
        orientationEvent.beta = beta;
        orientationEvent.gamma = gamma;
      };
      window.addEventListener("deviceorientation", orient, true);
    }
  } catch (e) {
    alert(e);
    console.error("e", e);
  }
};
