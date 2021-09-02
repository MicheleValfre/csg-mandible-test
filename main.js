import * as THREE from "https://threejs.org/build/three.module.js";
import { OrbitControls } from "https://threejs.org/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://threejs.org/examples/jsm/controls/TransformControls.js";
import { GLTFLoader } from "https://threejs.org/examples/jsm/loaders/GLTFLoader.js";
import { ConvexGeometry } from "https://threejs.org/examples/jsm/geometries/ConvexGeometry.js";


import CSG from "https://manthrax.github.io/THREE-CSGMesh/three-csg.js";

import { STLLoader } from "https://threejs.org/examples/jsm/loaders/STLLoader.js";

let camera;
let renderer;
let scene;
let controls;
let boneAGeometry, boneAMesh, boneAMaterial, boneAVisible;
let boneCGeometry, boneCMesh, boneCMaterial, boneCVisible, boneCPlaced;
let sliceBoxes;
let sliceBoxesC;
let slice;
let root, sz;
let cutPerformed;
let points, pointsC, pointsCColours;
let lineSizes, linesNormalized;
let lines;
let planesVertices;
let planesGrps
let grpToPlace;

const planeSide = 22;

function init(){
        //Initializing global variables
        grpToPlace = 0;
        planesGrps = [];
        sliceBoxesC = [];
        lines = [];
        planesVertices = [];
        boneAVisible = true;
        boneCPlaced = false;
        points = [];
        pointsC = [];
        pointsCColours = [0x56f062,0xede354,0xd46ebb];
        lineSizes = [];
        linesNormalized = [];
        cutPerformed = false;

        //Setting up scene
        camera = new THREE.PerspectiveCamera(
          60,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        camera.position.set(1, 1, 1).multiplyScalar(80);

        scene = new THREE.Scene();

        renderer = new THREE.WebGLRenderer({
            antialias: true
        });
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.VSMShadowMap;
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.autoRotateSpeed = 1;

        const clock = new THREE.Clock();

        onWindowResize();
        window.addEventListener("resize", onWindowResize, false);

        const lights = new THREE.Object3D();

        let light = new THREE.DirectionalLight("white", 1.1);
        light.shadow.enabled = true;
        light.position.set(1, 1, 1).multiplyScalar(100);
        lights.add(light);

        //Seting up shadow properties for the light
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        light.shadow.radius = 4;
        let lc = light.shadow.camera;
        lc.near = 0.5;
        lc.far = 500;

        lc.left = lc.bottom = -120;
        lc.right = lc.top = 120;
        lc.updateProjectionMatrix();

        light.shadow.bias = -0.0005;

        let dirLight = light;
        dirLight.castShadow = true;

        let light1 = new THREE.PointLight(0xffffff);
        light1.position.set(5, 9, -5).multiplyScalar(100);

        let light2 = new THREE.PointLight(0xffffff);
        light2.position.set(-1, -1, -1).multiplyScalar(100);

        light2.position.set(0, 0, 1);
        camera.add(light2);
        scene.add(lights);

        scene.add(camera);

        const axesHelper = new THREE.AxesHelper(5);
        scene.add(axesHelper);


        //Loading mesh
        const loader = new STLLoader();
        loader.load('./stl/Bone_A.stl', geometry => {
            boneAGeometry = geometry;
            boneAMaterial = new THREE.MeshPhongMaterial({
                color: 0xcdcfc9,
                shading: THREE.SmoothShading
            });
            boneAMesh = new THREE.Mesh(boneAGeometry, boneAMaterial);
            scene.add(boneAMesh);
            boneAGeometry.computeBoundingBox();
            sz = 0.4;
            boneAMesh.scale.multiplyScalar(sz);
            root = new THREE.Object3D();
            root.attach(boneAMesh);
            scene.add(root);
            root.rotation.x = Math.PI * -0.7;
            scene.attach(boneAMesh);
            boneAMesh.renderOrder = 0;
        
            boneAMesh.geometry.center();
        });

        //Setting up transform controls for the planes in the last part 
        let transformControls = new TransformControls(camera,renderer.domElement);
        scene.add(transformControls);
        transformControls.size = 1;
        transformControls.setMode("translate");
        transformControls.addEventListener("dragging-changed",function(event){
            controls.enabled = !event.value;
        })

        //Setting initial message
        window.info.innerText = 'Add point: double click on the bone';
        
        //Event listeners
        let toPlace = false;
        let planes = 0;
        sliceBoxes = [];
        document.addEventListener("keydown", e => {
            //Perform cut once the planes are placed
            if(e.code == "KeyC"){
                if(planes ==3){
                    window.info.innerText = 'Performing cut, please, wait...';
                    setTimeout(() => {
                        let tstart = performance.now();
                        if(slice){
                            slice.parent.remove(slice);
                            slice.geometry.dispose();
                        }
                        let scl = 200;
                        let A,B,C,D,E,F;
                        let positions = [];
                        let vectors = [];
                        let allVertices = [];
                        for(i in sliceBoxes){
                            sliceBoxes[i].updateMatrixWorld();
                            positions[i] = new Float32Array(sliceBoxes[i].geometry.attributes.position.array);
                            vectors[i] = [];
                            for(var j  = 0; j < positions[i].length; j+= 3){
                                const tmpVec = new THREE.Vector3(positions[i][j],positions[i][j+1],positions[i][j+2]);
                                tmpVec.applyMatrix4(sliceBoxes[i].matrixWorld);
                                vectors[i].push(tmpVec);
                            }
                        }

                        //Creating slicer
                        for(var i = 0; i < sliceBoxes.length - 1; i++){

                            const sliceGeo = new ConvexGeometry(vectors[i].concat(vectors[i+1]));
                            const sliceMesh = new THREE.Mesh(sliceGeo,new THREE.MeshBasicMaterial({color:pointsCColours[0]}));
                            sliceBoxesC.push(sliceMesh);
                            allVertices = allVertices.concat(vectors[i].concat(vectors[i+1]));
                        }

                        const wholeSlicerGeo = new ConvexGeometry(allVertices);
                        const wholeSlicer = new THREE.Mesh(wholeSlicerGeo,new THREE.MeshBasicMaterial({color:pointsCColours[0]}));
                        scene.add(wholeSlicer);

                        //Slicing
                        scene.updateMatrixWorld(true);
                        
                        let bspA = CSG.fromMesh(boneAMesh);
                        let bspB = CSG.fromMesh(wholeSlicer);
                        let bspC = bspA.subtract(bspB);

                        let result= CSG.toMesh(bspC,boneAMesh.matrix);
                        result.material = new THREE.MeshPhongMaterial({
                            color: 0x579ee5,
                            shading: THREE.SmoothShading
                        });
                        result.castShadow = result.receiveShadow = true;
                        result.renderOrder = 2;
                        let time = performance.now() - tstart;
                        window.info.innerText = "Time for rendering: " + time + " msec\nAdd plane couple: double click on the second bone";
                        scene.add(result);


                        scene.remove(wholeSlicer);

                        cutPerformed = true;
                        
                        loader.load('./stl/Bone_C.stl', geometry => {
                            boneCGeometry = geometry;
                            boneCMaterial = new THREE.MeshPhongMaterial({
                                color: 0xcdcfc9,
                                shading: THREE.SmoothShading
                            });
                            boneCMesh= new THREE.Mesh(boneCGeometry, boneCMaterial);
                            scene.add(boneCMesh);
                            boneCGeometry.computeBoundingBox();
                            sz = 0.4;
                            boneCMesh.scale.multiplyScalar(sz);
                            root = new THREE.Object3D();
                            root.attach(boneCMesh);
                            scene.add(root);
                            scene.attach(boneCMesh);
                            boneCMesh.renderOrder = 0;
                            boneCMesh.geometry.center();
                            boneCMesh.position.set(0,-50,0);
                            boneCMesh.rotation.y = (1.570796);
                            boneCPlaced = true;
                        });
                        window.info.innerText += "\n[T]: toggle cut part";
                    },
                    100);
                }
                
            }
            //Turn on/off sliced part
            if(e.code == "KeyT"){
                if(cutPerformed){
                    if(boneAVisible){
                        boneAMesh.visible = false;
                        boneAVisible = false;
                    }
                    else{
                        boneAMesh.visible = true;
                        boneAVisible = true;
                    }
                }
            }
            if(e.code == "KeyS"){
                //Operate cut/substitution of bone C parts
                if(boneCPlaced && pointsC.length == 3){
                        transformControls.detach();
                        for(var i = 0; i < planesGrps.length; i++){
                            let vecsA = [];
                            const vecsB = [];
                            const planeA = planesGrps[i].children[0];
                            const planeB = planesGrps[i].children[1];
                            planeA.updateMatrixWorld();
                            planeB.updateMatrixWorld();

                            const tmpArrA = new Float32Array(planeA.geometry.attributes.position.array);
                            const tmpArrB = new Float32Array(planeB.geometry.attributes.position.array);
                            for(var j = 0; j < tmpArrA.length; j += 3){
                                const tmpVec = new THREE.Vector3(tmpArrA[j],tmpArrA[j+1],tmpArrA[j+2]);
                                tmpVec.applyMatrix4(planeA.matrixWorld);
                                vecsA.push(tmpVec);
                            }
                            for(var j = 0; j < tmpArrB.length; j += 3){
                                const tmpVec = new THREE.Vector3(tmpArrB[j],tmpArrB[j+1],tmpArrB[j+2]);
                                tmpVec.applyMatrix4(planeB.matrixWorld);
                                vecsB.push(tmpVec);
                            }

                            const sliceGeo = new ConvexGeometry(vecsA.concat(vecsB));
                            const sliceMesh = new THREE.Mesh(sliceGeo,new THREE.MeshBasicMaterial({color:pointsCColours[0]}));
                            scene.add(sliceMesh);

                            scene.updateMatrixWorld(true);
                            let bspA_C, bspB_C, bspC_C;
                            bspA_C = CSG.fromMesh(boneCMesh);
                            bspB_C = CSG.fromMesh(sliceMesh);
                            bspC_C = bspA_C.intersect(bspB_C);
                            const piece = CSG.toMesh(bspC_C,boneCMesh.matrix);
                            piece.material = new THREE.MeshPhongMaterial({color:pointsCColours[i]});
                            scene.add(piece);
                            piece.geometry.computeBoundingBox();
                            piece.geometry.center();
                            const mid = calculateMidPoint(points[i],points[i+1]);
                            piece.position.copy(mid);
                            scene.remove(sliceMesh);
                            piece.lookAt(points[i+1]);
                            window.info.innerText = "Substitution performed";
                        }
                    }
            }
            if(e.code == "KeyM"){
                transformControls.setMode('translate');
            }
            if(e.code == "KeyR"){
                transformControls.setMode('rotate');
            }
        });
        window.addEventListener('dblclick',function(){
            if(!boneCPlaced){
                const mouse = new THREE.Vector2();
                mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse,camera);
                const intersects = raycaster.intersectObjects( scene.children );
                if(intersects.length > 0 && points.length < 4){
                    const tmp = new THREE.SphereGeometry(1,1,1);
                    const tmpm = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
                    const sphere = new THREE.Mesh( tmp, tmpm);
                    sphere.position.copy(intersects[0].point);
                    scene.add(sphere);
                    points.push(intersects[0].point);
                    if(points.length >= 2){
                        lineSizes.push(distanceVector(points[points.length-1],points[points.length-2]));
                        linesNormalized.push(lineToNormalizedVector(points[points.length-1],points[points.length-2])); 
                    }
                    const lineGeometry = new THREE.BufferGeometry().setFromPoints( points );
                    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
                    const line = new THREE.Line(lineGeometry,lineMaterial);
                    scene.add(line);
                    lines.push(line);
                    if(points.length == 4 && !boneCPlaced && planes < 4){
                        window.info.innerText = "Press [C] when you're ready to perform the cut"
                        for(planes = 0; planes < 3; planes++){
                            sliceBoxes[planes] = new THREE.Mesh(new THREE.PlaneGeometry(planeSide,planeSide),new THREE.MeshBasicMaterial( {color: 0xabfea5, side: THREE.DoubleSide} ));
                            sliceBoxes[planes].geometry.center();
                            sliceBoxes[planes].position.copy(points[planes]);
                            sliceBoxes[planes].lookAt(points[planes+1]);
                            if(planes >= 1){
                                const grp = new THREE.Group();
                                grp.add(sliceBoxes[planes-1].clone());
                                grp.add(sliceBoxes[planes].clone());
                                planesGrps.push(grp);
                                scene.add(grp);
                            }
                        }
                        sliceBoxes[3] = new THREE.Mesh(new THREE.PlaneGeometry(planeSide,planeSide),new THREE.MeshBasicMaterial( {color: 0xabfea5, side: THREE.DoubleSide} ));
                        sliceBoxes[3].geometry.center();
                        sliceBoxes[3].position.copy(points[3]);
                        sliceBoxes[3].rotation.y += Math.PI / 2;
                        const grp = new THREE.Group();
                        grp.add(sliceBoxes[2]);
                        grp.add(sliceBoxes[3].clone());
                        planesGrps.push(grp);
                        const ah = new THREE.AxesHelper(10);
                        grp.add(ah);
                        scene.add(grp);
                    }
                }
            }
            else{
                const mouse = new THREE.Vector2();
                mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse,camera);
                const intersects = raycaster.intersectObjects( scene.children );
                if(intersects.length > 0 && pointsC.length < 3){
                    const pt = intersects[0].point;
                    const grpC = planesGrps[grpToPlace];
                    scene.add(grpC);
                    grpC.position.copy(pt);
                    pointsC.push(grpC);
                    grpToPlace++;
                    transformControls.attach(grpC);
                    var msg = "Transpose the planes using the available controls:\n[M]: switch to move mode\n[R]: switch to rotate mode\nWhen you're ready to add the next planes: double click on the bone";
 
                    if(pointsC.length == 3){
                        msg += "\nWhen you are ready to perform the substitution, press [S]";
                    }
                    window.info.innerText = msg;
                }
            }
        });
}



function render() {
  controls.update();
  renderer.render(scene, camera);
}

function onWindowResize(event) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function distanceVector( v1, v2 )
{
    var dx = v1.x - v2.x;
    var dy = v1.y - v2.y;
    var dz = v1.z - v2.z;

    return Math.sqrt( dx * dx + dy * dy + dz * dz );
}

function lineToNormalizedVector( v1, v2){
    const v = new THREE.Vector3(
            v1.x - v2.x,
            v1.y - v2.y,
            v1.z - v2.z
    );
    return v.normalize();
}

function calculateMidPoint(v1,v2){
    return new THREE.Vector3(
        (v1.x + v2.x)/2,
        (v1.y + v2.y)/2,
        (v1.z + v2.z)/2
    );
}



function generatePlane(pts,index){
    let vert = [];
    let pt = pts[index];
    vert[0] = new THREE.Vector3(pt.x+15,pt.y+15,pt.z);
    vert[1] = new THREE.Vector3(pt.x-15,pt.y+15,pt.z);
    vert[2] = new THREE.Vector3(pt.x+15,pt.y-15,pt.z);
    vert[3] = new THREE.Vector3(pt.x-15,pt.y-15,pt.z);

    if(index == 0){
        vert[0].z +=15;
        vert[1].z +=15;
        vert[2].z -=15;
        vert[3].z -=15;
        vert[0].y -= 15;
        vert[1].y -= 15;
        vert[2].y += 15;
        vert[3].y += 15;
    }


    let cnvx = new CustomPlaneGeometry(vert);

    let mat = new THREE.MeshBasicMaterial( { color: pointsCColours[index]} );

    let msh = new THREE.Mesh(cnvx,mat);




    planesVertices.push(vert);
    return msh; 
}

function float32Concat(first, second)
{
    var firstLength = first.length,
        result = new Float32Array(firstLength + second.length);

    result.set(first);
    result.set(second, firstLength);

    return result;
}



init();
animate();
