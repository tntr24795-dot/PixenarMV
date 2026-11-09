"use client";

import { useEffect, useRef } from "react";

const vertexShader = `
attribute vec3 aPosition;
attribute vec3 aColor;
uniform mat4 uMatrix;
varying vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = uMatrix * vec4(aPosition, 1.0);
}`;
const fragmentShader = `
precision mediump float;
varying vec3 vColor;
void main() { gl_FragColor = vec4(vColor, 0.92); }`;

function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
  return s;
}

const faces = [
  [0, 1, 2, 0, 2, 3], [4, 6, 5, 4, 7, 6],
  [4, 5, 1, 4, 1, 0], [3, 2, 6, 3, 6, 7],
  [1, 5, 6, 1, 6, 2], [4, 0, 3, 4, 3, 7],
];
const corners = [
  [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],
  [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
];
const shades = [
  [0.08,0.66,1],[0.02,0.22,0.52],[0.07,0.38,0.78],
  [0.12,0.52,0.91],[0.04,0.31,0.65],[0.06,0.25,0.48],
];
function matrix(rx:number,ry:number,scale:number,offsetX:number,offsetY:number,aspect:number): Float32Array {
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry);
  const out=new Float32Array(16);
  const depth=2.8, focal=2.8;
  // Projection times Y/X rotation, plus position. Column-major.
  out[0]=cy*scale*focal/aspect; out[1]=sx*sy*scale*focal; out[2]=cx*sy*scale; out[3]=sy*scale;
  out[4]=0; out[5]=cx*scale*focal; out[6]=-sx*scale; out[7]=0;
  out[8]=-sy*scale*focal/aspect; out[9]=sx*cy*scale*focal; out[10]=cx*cy*scale; out[11]=cy*scale;
  out[12]=offsetX*focal/aspect; out[13]=offsetY*focal; out[14]=depth-0.5; out[15]=depth;
  // Use homogeneous projection with w dependent on z, and clip z set to zero.
  out[2]=0;out[6]=0;out[10]=0;out[14]=0;
  return out;
}
export default function Studio3DScene() {
  const canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const node=canvas.current;
    if(!node) return;
    const gl=node.getContext("webgl",{alpha:true,antialias:true});
    if(!gl) return;
    const vs=shader(gl,gl.VERTEX_SHADER,vertexShader);
    const fs=shader(gl,gl.FRAGMENT_SHADER,fragmentShader);
    if(!vs||!fs)return;
    const program=gl.createProgram();
    if(!program)return;
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
    const data:number[]=[];
    faces.forEach((face,i)=>face.forEach(index=>{
      data.push(...corners[index],...shades[i]);
    }));
    const buffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
    gl.useProgram(program);
    const pos=gl.getAttribLocation(program,"aPosition");
    const color=gl.getAttribLocation(program,"aColor");
    gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12);
    const uniform=gl.getUniformLocation(program,"uMatrix");
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let targetX=0,targetY=0,mx=0,my=0,frame=0,raf=0;
    const move=(e:PointerEvent)=>{
      const r=node.getBoundingClientRect();
      targetX=((e.clientX-r.left)/r.width-.5)*0.65;
      targetY=((e.clientY-r.top)/r.height-.5)*0.45;
    };
    node.addEventListener("pointermove",move);
    const reset=()=>{targetX=0;targetY=0;};
    node.addEventListener("pointerleave",reset);
    const draw=()=>{
      const width=Math.min(node.clientWidth*window.devicePixelRatio,1800);
      const height=Math.min(node.clientHeight*window.devicePixelRatio,1000);
      if(node.width!==Math.round(width)||node.height!==Math.round(height)){
        node.width=Math.round(width);node.height=Math.round(height);
      }
      gl.viewport(0,0,node.width,node.height);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      mx+=(targetX-mx)*.06;my+=(targetY-my)*.06;
      if(!reduced)frame+=.008;
      const aspect=Math.max(.7,node.width/Math.max(node.height,1));
      [[-.98,.15,.58,0],[.9,-.36,.33,1],[.2,.72,.21,2]].forEach(([x,y,s,i])=>{
        gl.uniformMatrix4fv(uniform,false,matrix(-.25+my+frame*.35,frame*(i===1?-.7:.55)+mx+.4,s,x,y,aspect));
        gl.drawArrays(gl.TRIANGLES,0,36);
      });
      if(!reduced)raf=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(raf);node.removeEventListener("pointermove",move);node.removeEventListener("pointerleave",reset);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  },[]);
  return <div className="studio3dScene" aria-hidden="true"><canvas ref={canvas}/></div>;
}
