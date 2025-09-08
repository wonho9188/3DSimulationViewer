import React, { useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from '@react-three/drei';
// import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { KeyboardForGame } from './utils/keyboardForGame';
import './assets/css/index.scss';
import Button from '@mui/material/Button';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import pathData from './assets/sample_path.json';

type OrbitControlsType = any;

const App: React.FC = () => {
  
  // keyboardForGame 인스턴스 생성
  const keyboardRef = useRef<KeyboardForGame | null>(null); // 키 입력
  const meshRef = useRef<THREE.Mesh>(null); // 박스 메쉬 참조
  const position = useRef<[number, number, number]>([0, 0.5, 0]); // 박스 현재 위치

  const orbitRef = useRef<OrbitControlsType | null>(null); // 카메라 참조

  // 곡선 경로와 진행 상태 (ref로 관리)
  const curveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const curveTRef = useRef(0); // 0~1 사이 진행도
  const isCurveMovingRef = useRef(false);
  const cameraOffsetRef = useRef<THREE.Vector3 | null>(null); // 곡선 이동용 카메라 오프셋
  // 회전 애니메이션 상태 (ref로 관리)
  const isRotatingRef = useRef(false);
  const targetAngleYRef = useRef<number>(0);
  const startAngleYRef = useRef<number>(0);
  const rotationProgressRef = useRef<number>(0);
  const pendingCurveRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const pendingCameraOffsetRef = useRef<THREE.Vector3 | null>(null);
  // 마지막 각도 유지용
  const lastAngleYRef = useRef<number>(0);

  // keyboardForGame 인스턴스는 최초 렌더 시 한 번만 생성
  if (!keyboardRef.current) {
    keyboardRef.current = new KeyboardForGame();
  }

  // MovableBox에서 박스 위치를 업데이트
  function MovableBoxWithSync({ keyboard }: { keyboard: KeyboardForGame }) {
    const { camera } = useThree();
    useFrame((_, delta) => {
        // rotation.y를 항상 -π ~ π 또는 0 ~ 2π로 wrap
        if (meshRef.current) {
          // 0~2π로 wrap
          meshRef.current.rotation.y = ((meshRef.current.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        }
      if (meshRef.current && keyboard) {
        // 디버그 패널 실시간 갱신
        if (debugRef.current) {
          const x = meshRef.current.position.x.toFixed(2);
          const z = meshRef.current.position.z.toFixed(2);
          let angle = (meshRef.current.rotation.y * 180) / Math.PI;
          // 0~360도로 wrap
          angle = ((angle % 360) + 360) % 360;
          debugRef.current.innerHTML = `
            <b>Debug</b><br />
            x: ${x}<br />
            z: ${z}<br />
            θ: ${angle.toFixed(1)}°
          `;
        }

        // 1. 회전 애니메이션 우선
        if (isRotatingRef.current) {
          const duration = 0.5;
          rotationProgressRef.current += delta / duration;
          let t = rotationProgressRef.current;
          if (t > 1) t = 1;
          const start = startAngleYRef.current;
          const end = targetAngleYRef.current;
          let diff = end - start;
          if (diff > Math.PI) diff -= Math.PI * 2;
          if (diff < -Math.PI) diff += Math.PI * 2;
          const angleY = start + diff * t;
          const [px, py, pz] = position.current;
          meshRef.current.position.set(px, py, pz);
          meshRef.current.rotation.y = angleY;
          camera.lookAt(px, py, pz);
          if (orbitRef.current) {
            orbitRef.current.target.set(px, py, pz);
            orbitRef.current.update();
          }
          if (t >= 1) {
            isRotatingRef.current = false;
            if (pendingCurveRef.current) {
              curveRef.current = pendingCurveRef.current;
              curveTRef.current = 0;
              isCurveMovingRef.current = true;
              if (pendingCameraOffsetRef.current) {
                cameraOffsetRef.current = pendingCameraOffsetRef.current;
              }
              pendingCurveRef.current = null;
              pendingCameraOffsetRef.current = null;
            }
          }
          return;
        }

        // 2. 곡선 경로 이동
        if (curveRef.current && isCurveMovingRef.current) {
          const speed = 0.3;
          let nextT = curveTRef.current + speed * delta;
          let finished = false;
          if (nextT > 1) {
            nextT = 1;
            isCurveMovingRef.current = false;
            finished = true;
          }
          curveTRef.current = nextT;
          const pos = curveRef.current.getPoint(nextT);
          position.current = [pos.x, pos.y, pos.z];
          meshRef.current.position.set(pos.x, pos.y, pos.z);
          if (nextT < 1) {
            const tangent = curveRef.current.getTangent(nextT);
            const angleY = Math.atan2(-tangent.x, -tangent.z);
            meshRef.current.rotation.y = angleY;
            lastAngleYRef.current = angleY;
          } else if (finished) {
            const tangent = curveRef.current.getTangent(1);
            const angleY = Math.atan2(-tangent.x, -tangent.z);
            meshRef.current.rotation.y = angleY;
            lastAngleYRef.current = angleY;
          }
          if (orbitRef.current && cameraOffsetRef.current) {
            orbitRef.current.object.position.set(
              pos.x + cameraOffsetRef.current.x,
              pos.y + cameraOffsetRef.current.y,
              pos.z + cameraOffsetRef.current.z
            );
            orbitRef.current.target.set(pos.x, pos.y, pos.z);
            orbitRef.current.update();
          }
          return;
        }

        // 3. 키 입력 이동
        const moveSpeed = 5 * delta;
        let forward = 0;
        const upPressed = keyboard.pressed('up') || keyboard.pressed('W') || mouseUp.current;
        const downPressed = keyboard.pressed('down') || keyboard.pressed('S') || mouseDown.current;
        const leftPressed = keyboard.pressed('left') || keyboard.pressed('A') || mouseLeft.current;
        const rightPressed = keyboard.pressed('right') || keyboard.pressed('D') || mouseRight.current;
        if (upPressed) forward -= moveSpeed;
        if (downPressed) forward += moveSpeed;

        const rotateSpeed = 2 * delta;
        if (leftPressed) {
          meshRef.current.rotation.y += rotateSpeed;
        }
        if (rightPressed) {
          meshRef.current.rotation.y -= rotateSpeed;
        }

        const angle = meshRef.current.rotation.y;
        const vx = Math.sin(angle) * forward;
        const vz = Math.cos(angle) * forward;

        const [x, y, z] = position.current;
        const nx = x + vx;
        const ny = y;
        const nz = z + vz;
        position.current = [nx, ny, nz];
        meshRef.current.position.set(nx, ny, nz);

        camera.position.x += vx;
        if (camera.position.y < 2) camera.position.y = 2;
        camera.position.z += vz;
        camera.lookAt(nx, ny, nz);
        if (orbitRef.current) {
          orbitRef.current.target.set(nx, ny, nz);
          orbitRef.current.update();
        }
      }
    });

    // 6면체 각 면의 material: [right, left, top, bottom, back(-Z, 빨간색), front(+Z, 파란색)]
    const boxMaterials = [
      new THREE.MeshStandardMaterial({ color: '#ff9800', roughness: 0.4, metalness: 0.2 }), // right +X
      new THREE.MeshStandardMaterial({ color: '#ff9800', roughness: 0.4, metalness: 0.2 }), // left -X
      new THREE.MeshStandardMaterial({ color: '#ff9800', roughness: 0.4, metalness: 0.2 }), // top +Y
      new THREE.MeshStandardMaterial({ color: '#ff9800', roughness: 0.4, metalness: 0.2 }), // bottom -Y
      new THREE.MeshStandardMaterial({ color: '#f44336', roughness: 0.4, metalness: 0.2 }), // back -Z (빨간색)
      new THREE.MeshStandardMaterial({ color: '#2196f3', roughness: 0.4, metalness: 0.2 }), // front +Z (파란색)
    ];
    return (
      <>
        <mesh ref={meshRef} castShadow material={boxMaterials}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <OrbitControls ref={orbitRef} />
      </>
    );
  }

  const handleButtonClick = (location: string) => {
    type PathKeys = keyof typeof pathData;
    const key: PathKeys = location as PathKeys;
    const selectedPath = pathData[key];
  if (selectedPath && selectedPath.length > 1) {
      // 현재 위치와 path 첫 위치가 같으면 현재 위치를 경로에 추가하지 않음
      const [curX, curY, curZ] = position.current;
      const firstPath = selectedPath[0];
      const isSame = Math.abs(curX - firstPath.x) < 1e-6 && Math.abs(curY - firstPath.y) < 1e-6 && Math.abs(curZ - firstPath.z) < 1e-6;
      let points: THREE.Vector3[];
      if (isSame) {
        points = selectedPath.map(p => new THREE.Vector3(p.x, p.y, p.z));
      } else {
        const currentPos = new THREE.Vector3(curX, curY, curZ);
        points = [currentPos, ...selectedPath.map(p => new THREE.Vector3(p.x, p.y, p.z))];
      }
      const newCurve = new THREE.CatmullRomCurve3(points);
      // 목표 각도 계산 (현재 위치~첫 번째 경로점)
      const first = points[0];
      const second = points[1];
      const dir = new THREE.Vector3().subVectors(second, first);
      const angleY = Math.atan2(-dir.x, -dir.z);
      // 회전 애니메이션 세팅
      if (meshRef.current) {
        startAngleYRef.current = meshRef.current.rotation.y;
      } else {
        startAngleYRef.current = 0;
      }
      targetAngleYRef.current = angleY;
      rotationProgressRef.current = 0;
      pendingCurveRef.current = newCurve;
      // 카메라 오프셋도 미리 계산
      if (orbitRef.current) {
        const offset = orbitRef.current.object.position.clone().sub(orbitRef.current.target);
        pendingCameraOffsetRef.current = offset;
      } else {
        pendingCameraOffsetRef.current = null;
      }
      // 박스 위치만 즉시 이동, 방향은 애니메이션으로
      position.current = [first.x, first.y, first.z];
      if (meshRef.current) {
        meshRef.current.position.set(first.x, first.y, first.z);
      }
      isRotatingRef.current = true;
  } else if (selectedPath && selectedPath.length === 1) {
      // 한 점만 있으면 바로 이동
      const { x, y, z } = selectedPath[0];
      position.current = [x, y, z];
      if (meshRef.current) meshRef.current.position.set(x, y, z);
      if (orbitRef.current) {
        const offset = orbitRef.current.object.position.clone().sub(orbitRef.current.target);
        orbitRef.current.object.position.set(x + offset.x, y + offset.y, z + offset.z);
        orbitRef.current.target.set(x, y, z);
        orbitRef.current.update();
      }
    }
  }

  const theme = createTheme({
    palette: {
      primary: {
        main: '#1c2ded', // 원하는 색상
      },
      secondary: {
        main: '#ff9800',
      },
    },
  });

  // 디버그용 상태: x, z, 각도
  const debugRef = useRef<HTMLDivElement>(null);
  const mouseUp = useRef<boolean>(false);
  const mouseLeft = useRef<boolean>(false);
  const mouseDown = useRef<boolean>(false);
  const mouseRight = useRef<boolean>(false);

  return (
    <div className="app">
      {/* 디버그 패널 */}
      <div className="debug-panel">
        <div ref={debugRef}></div>
      </div>
      <Canvas shadows camera={{ fov: 60, position: [10, 10, 15] }}>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        {/* 바닥 */}
        <mesh receiveShadow position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#e0e0e0" />
        </mesh>
        {/* 박스 */}
        <MovableBoxWithSync keyboard={keyboardRef.current!} />
      </Canvas>
      <ThemeProvider theme={theme}>
        <div className="floating-section">
          <Button onClick={() => handleButtonClick('hospital')} variant='contained'> 병원 </Button>
          <Button onClick={() => handleButtonClick('library')} variant="contained"> 도서실 </Button>
          <Button onClick={() => handleButtonClick('convenience_store')} variant="contained"> 편의점 </Button>
        </div>
        {/* 상하좌우 플로팅 버튼 */}
        <div className="floating-arrow-pad">
          <button
            className="arrow-btn up"
            aria-label="up"
            onMouseDown={() => { mouseUp.current = true; }}
            onMouseUp={() => { mouseUp.current = false; }}
            onMouseLeave={() => { mouseUp.current = false; }}
            onTouchStart={() => { mouseUp.current = true; }}
            onTouchEnd={() => { mouseUp.current = false; }}
            onTouchCancel={() => { mouseUp.current = false; }}
          ></button>
          <div>
            <button
              className="arrow-btn left"
              aria-label="left"
              onMouseDown={() => { mouseLeft.current = true; }}
              onMouseUp={() => { mouseLeft.current = false; }}
              onMouseLeave={() => { mouseLeft.current = false; }}
              onTouchStart={() => { mouseLeft.current = true; }}
              onTouchEnd={() => { mouseLeft.current = false; }}
              onTouchCancel={() => { mouseLeft.current = false; }}
            ></button>
            <button
              className="arrow-btn down"
              aria-label="down"
              onMouseDown={() => { mouseDown.current = true; }}
              onMouseUp={() => { mouseDown.current = false; }}
              onMouseLeave={() => { mouseDown.current = false; }}
              onTouchStart={() => { mouseDown.current = true; }}
              onTouchEnd={() => { mouseDown.current = false; }}
              onTouchCancel={() => { mouseDown.current = false; }}
            ></button>
            <button
              className="arrow-btn right"
              aria-label="right"
              onMouseDown={() => { mouseRight.current = true; }}
              onMouseUp={() => { mouseRight.current = false; }}
              onMouseLeave={() => { mouseRight.current = false; }}
              onTouchStart={() => { mouseRight.current = true; }}
              onTouchEnd={() => { mouseRight.current = false; }}
              onTouchCancel={() => { mouseRight.current = false; }}
            ></button>
          </div>
        </div>
      </ThemeProvider>
    </div>
  );
};

export default App;