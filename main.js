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
let pointMeshes;
let planeMeshes;
let planePairs;

const planeSide = 22;

function init(){
        //Initializing global variables
        planePairs = [];
        planeMeshes = [];
        pointMeshes = [];
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
        camera = new THREE.OrthographicCamera(
            window.innerWidth / - 2,
            window.innerWidth / 2,
            window.innerHeight / 2,
            window.innerHeight / - 2,
            10,
            1000
        );
        camera.position.set(1, 1, 1).multiplyScalar(80);
        camera.zoom = 10;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

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
        loader.load('Bone_A.stl', geometry => {
            boneAGeometry = geometry;
            boneAMaterial = new THREE.MeshPhongMaterial({
                color: 0xbababa,
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
                if(planes == 4){
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
                        
                        loader.load('Bone_C.stl', geometry => {
                            boneCGeometry = geometry;
                            boneCMaterial = new THREE.MeshPhongMaterial({
                                color: 0x7a7a7a,
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
                            boneCMesh.rotation.y = Math.PI / 2;
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
                if(boneCPlaced && planePairs.length == 3){
                    transformControls.detach();
                    var positions = [];
                    var vectors = [];
                    for(var i in planePairs){
                        planePairs[i].children[0].updateMatrixWorld();
                        planePairs[i].children[1].updateMatrixWorld();

                        positions[i] = [];
                        positions[i][0] = new Float32Array(planePairs[i].children[0].geometry.attributes.position.array);
                        positions[i][1] = new Float32Array(planePairs[i].children[1].geometry.attributes.position.array);

                        vectors[i] = [];
                        vectors[i][0] = [];
                        vectors[i][1] = [];
                        
                        //Note: positions[i][0].length == positions[i][1].length
                        for(var j = 0; j < positions[i][0].length; j+= 3){
                            //0
                            const tmpVec = new THREE.Vector3(positions[i][0][j], positions[i][0][j+1], positions[i][0][j+2]);
                            tmpVec.applyMatrix4(planePairs[i].children[0].matrixWorld);
                            vectors[i][0].push(tmpVec);
                            //1
                            const tmpVec2 = new THREE.Vector3(positions[i][1][j], positions[i][1][j+1], positions[i][1][j+2]);
                            tmpVec2.applyMatrix4(planePairs[i].children[1].matrixWorld);
                            vectors[i][1].push(tmpVec2);
                        }
                    }
                    //Creating slicer
                    var slicerList = [];
                    for(var i = 0; i < planePairs.length; i++){
                        console.log(i);
                        console.log(vectors[i][0].length);
                        console.log(vectors[i][1].length);
                        const sliceGeo = new ConvexGeometry(vectors[i][0].concat(vectors[i][1]));
                        const sliceMesh = new THREE.Mesh(sliceGeo,new THREE.MeshBasicMaterial({color:pointsCColours[0]}));
                        scene.add(sliceMesh);
                        slicerList.push(sliceMesh);
                    }

                    //Slicing
                    for(var i = 0; i < slicerList.length; i++){
                        scene.updateMatrixWorld(true);
                        var bspA_C = CSG.fromMesh(boneCMesh);
                        var bspB_C = CSG.fromMesh(slicerList[i]);
                        var bspC_C = bspA_C.intersect(bspB_C);
                        var piece = CSG.toMesh(bspC_C,boneCMesh.matrix);
                        piece.material = new THREE.MeshPhongMaterial({color: pointsCColours[i]}); 
                        piece.geometry.computeBoundingBox();
                        piece.geometry.center();
                        scene.add(piece);
                        scene.remove(slicerList[i]);
                        const mid = calculateMidPoint(points[i],points[i+1]);
                        piece.position.copy(mid);
                        piece.lookAt(points[i+1]);
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
                    pointMeshes.push(sphere);
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
                        window.info.innerText = "Press [C] when you're ready to perform the cut.\nOr select a plane in order to edit its position"
                        for(planes = 0; planes < 4; planes++){
                            sliceBoxes[planes] = new THREE.Mesh(new THREE.PlaneGeometry(planeSide,planeSide),new THREE.MeshBasicMaterial( {color: 0xabfea5, side: THREE.DoubleSide} ));
                            sliceBoxes[planes].geometry.center();
                            sliceBoxes[planes].position.copy(points[planes]);
                            if(planes < 3)
                                sliceBoxes[planes].lookAt(points[planes+1]);
                            else//Last plane can't look at next point(obviously)
                                sliceBoxes[planes].rotation.y += Math.PI / 2;
                            scene.add(sliceBoxes[planes]);
                        }
                    }
                }
            }
            else{
                if(planePairs.length < 3){
                    const mouse = new THREE.Vector2();
                    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	                mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
                    const raycaster = new THREE.Raycaster();
                    raycaster.setFromCamera(mouse,camera);
                    const intersects = raycaster.intersectObjects( scene.children );
                    if(intersects.length > 0){
                        const pt = intersects[0].point;
                        const index = planePairs.length;
                        console.log(index);
                        const p1 = sliceBoxes[index].clone();
                        const p2 = sliceBoxes[index+1].clone();

                        const grp = new THREE.Group();
                        grp.add(p1);
                        grp.add(p2);
                        scene.add(grp);
                        grp.position.copy(pt);
                        planePairs.push(grp);
                        transformControls.attach(grp);
                    }
                }
            }
        });

        window.addEventListener('click',function(){
            if(sliceBoxes.length == 4 && !boneCPlaced){
                transformControls.detach();
                const mouse = new THREE.Vector2();
                mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	            mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse,camera);
                const intersects = raycaster.intersectObjects( scene.children );
                if(intersects.length > 0){
                    const plane = intersects[0].object;
                    for(var i = 0; i < sliceBoxes.length; i++){
                        if(sliceBoxes[i] == plane){
                            transformControls.attach(plane);
                            break;
                        }
                    }
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

