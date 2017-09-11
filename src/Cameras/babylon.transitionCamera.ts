/// <reference path="babylon.targetCamera.ts" />

module BABYLON {

    export function isPresent(x:any):boolean {
        if (x == undefined)
            return false;
        if (x == null)
            return false;
        return true;
    }


    class CameraState {
        ortho:boolean = false;
        // Perspective camera memebrs
        yaw_deg:number = null;
        pitch_deg:number = null;
        distance:number = null;
        targetPos:Vector3 = new Vector3(null, null, null);
        fov_deg:number = null;
        // Orthographic camera members
        orthoLeft:number = null;
        orthoRight:number = null;
        orthoTop:number = null;
        orthoBottom:number = null;

        constructor() {
        }

        static ctor(yaw_deg:number,
                    pitch_deg:number,
                    distance:number,
                    targetPos:Vector3,
                    fov_deg:number,
                    ortho:boolean,
                    orthoLeft:number,
                    orthoRight:number,
                    orthoTop:number,
                    orthoBottom:number):CameraState {
            var result:CameraState = new CameraState();
            result.yaw_deg = yaw_deg;
            result.pitch_deg = pitch_deg;
            result.distance = distance;
            result.targetPos = targetPos.clone();
            result.fov_deg = fov_deg;
            result.ortho = ortho;
            result.orthoLeft = orthoLeft;
            result.orthoRight = orthoRight;
            result.orthoTop = orthoTop;
            result.orthoBottom = orthoBottom;
            return result;
        }

        equals(other:CameraState): boolean {
            if (this.ortho !== other.ortho)
                return false;

            if (!this.targetPos.equals(other.targetPos))
                return false;
            if (this.yaw_deg !== other.yaw_deg)
                return false;
            if (this.pitch_deg !== other.pitch_deg)
                return false;
            if (this.distance !== other.distance)
                return false;
            if (this.targetPos.x !== other.targetPos.x)
                return false;
            if (this.targetPos.y !== other.targetPos.y)
                return false;
            if (this.targetPos.z !== other.targetPos.z)
                return false;
            if (MathTools.WithinEpsilon(this.fov_deg, other.fov_deg, Epsilon))
                return false;

            if (!this.ortho) {
                if (this.orthoLeft !== other.orthoLeft)
                    return false;
                if (this.orthoRight !== other.orthoRight)
                    return false;
                if (this.orthoTop !== other.orthoTop)
                    return false;
                if (this.orthoBottom !== other.orthoBottom)
                    return false;
            }
            return true;
        }
    }
    class InertialVar {
        value:number;
        inertialOffset:number = 0;
        lowerLimit:number = null;
        upperLimit:number = null;

        constructor(value:number,
                    lowerLimit:number,
                    upperLimit:number) {
            this.value = value;
            this.inertialOffset = 0;
            this.lowerLimit = lowerLimit;
            this.upperLimit = upperLimit;
        }
    }

    export class TransitionCamera extends TargetCamera {
        // Current camera state
        private yaw_deg: InertialVar;
        private pitch_deg: InertialVar;
        private distance: InertialVar;
        private targetX: InertialVar;
        private targetY: InertialVar;
        private targetZ: InertialVar;
        public minDistance: number = 0.01;
        public maxDistance: number = 1000;

        // Remembered camera states
        private cacheState:CameraState; // Replaces base class's dangerous _cache:any object with something safer
        private perspectiveState:CameraState; // The final perspective view prior to entering an ortho view

        tumbleSensitivity: number; // Rate adjustment for tumble
        trackSensitivity: number;  // Rate adjustment for track
        wheelPrecision: number;    // Scale factor for dolly
        pinchPrecision: number;    // Scale factor for dolly
        nFrames: number = 60;      // Camera transitions' number of frames per transition
        fps: number = 60;          // Camera transitions' frames per second

        renderCanvas:HTMLCanvasElement;

        groundLevel: number; // To prevent the camera position and target from going below the floor

        prevUpdate_secs: number = -1;

        inputs: TransitionCameraInputsManager; // UI event management

        constructor(name:string,
                    scene:Scene,
                    yaw_deg:number,
                    pitch_deg:number,
                    minDistance:number,
                    maxDistance:number,
                    distance:number,
                    targetPos:Vector3,
                    fov_deg:number = 15,
                    inertia:number = 0.6,
                    groundLevel:number = null,
                    tumbleSensitivity:number = 1,
                    trackSensitivity:number = 1,
                    wheelPrecision:number = 3 ) {
            // position value passed to super class is not used.
            // Transition camera will re-calculate the camera
            // position based on the incoming yaw, pitch, distance, fov
            super(name, new Vector3(0, 0, 0), scene);

            this.yaw_deg = new InertialVar(yaw_deg, null, null);
            this.pitch_deg = new InertialVar(pitch_deg,
                -89.9,  // straight down
                +89.9); // straight up
            var maxd = maxDistance || (Number.MAX_VALUE * 2);
            var mind = minDistance || 0;
            this.distance = new InertialVar(MathTools.Clamp(distance, mind, maxd), minDistance, maxDistance);
            this.minDistance = minDistance;
            this.maxDistance = maxDistance;
            this.targetX = new InertialVar(targetPos.x, null, null);
            this.targetY = new InertialVar(targetPos.y, null, null);
            this.targetZ = new InertialVar(targetPos.z, null, null);
            this.fov = fov_deg * Math.PI / 180;

            this.inertia = inertia;

            this.groundLevel = isPresent(this.groundLevel) ? groundLevel : -100.0;
            if (isPresent(this.groundLevel)) {
                this.targetY.value = Math.max(this.groundLevel, this.targetY.value);
                this.targetY.lowerLimit = this.groundLevel;
            }
            this.tumbleSensitivity = tumbleSensitivity;
            this.trackSensitivity = trackSensitivity;
            this.wheelPrecision = wheelPrecision;

            this.renderCanvas = null;

            this.CalcPosition();

            this.cacheState = new CameraState();

            this.getViewMatrix();

            // Set up inputs from keyboard, mouse wheel and pointers
            this.inputs = new TransitionCameraInputsManager(this);
            this.inputs.addKeyboard().addMouseWheel().addPointers();

            console.log('Created Transition Camera');
        }

        attachControl(renderCanvas:HTMLCanvasElement, noPreventDefault?:boolean):void {
            this.renderCanvas = renderCanvas;
            this.inputs.attachElement(renderCanvas, noPreventDefault);
        }

        detachControl(renderCanvas?:HTMLCanvasElement) {
            this.inputs.detachElement(renderCanvas);
            this.renderCanvas = null;
        }

        public _checkInputs():void {

            // Combine all the inputs into offsets on the camera
            this.inputs.checkInputs();

            if (this.yaw_deg.inertialOffset == 0 &&
                this.pitch_deg.inertialOffset == 0 &&
                this.distance.inertialOffset == 0 &&
                this.targetX.inertialOffset == 0 &&
                this.targetY.inertialOffset == 0 &&
                this.targetZ.inertialOffset == 0) {
                this.prevUpdate_secs = -1;
                return; // nothing to do
            }
            var now_secs:number = window.performance.now() / 1000;
            if (this.prevUpdate_secs < 0) //First time through
                this.prevUpdate_secs = now_secs - 1 / 60;

            var dt:number = now_secs - this.prevUpdate_secs;
            this.prevUpdate_secs = now_secs;
            var nUpdateSteps:number = dt * 60; //same as dt / (1/60);

            var initialState:CameraState = this._getCurrState();
            this.InertialStep(this.pitch_deg, nUpdateSteps); // tumble
            this.InertialStep(this.yaw_deg, nUpdateSteps);   // tumble
            this.InertialStep(this.distance, nUpdateSteps);  // dolly
            this.InertialStep(this.targetX, nUpdateSteps);   // track
            this.InertialStep(this.targetY, nUpdateSteps);   // track
            this.InertialStep(this.targetZ, nUpdateSteps);   // track

            // Prevent the camera position from going below the floor
            if (isPresent(this.groundLevel)) {
                this.CalcPosition();
                var minCameraHeight = this.groundLevel + 1.0;
                if (this.position.y < minCameraHeight) {
                    this._restoreState(initialState);
                    this.targetX.inertialOffset = 0;
                    this.targetY.inertialOffset = 0;
                    this.targetZ.inertialOffset = 0;
                    this.distance.inertialOffset = 0;
                    this.pitch_deg.inertialOffset = 0;
                    this.yaw_deg.inertialOffset = 0;
                }
            }
            // Prevent the camera target from going below the floor
            if (isPresent(this.groundLevel)) {
                if (this.targetY.value < this.groundLevel) {
                    this._restoreState(initialState);
                    this.targetX.inertialOffset = 0;
                    this.targetY.inertialOffset = 0;
                    this.targetZ.inertialOffset = 0;
                    this.distance.inertialOffset = 0;
                    this.pitch_deg.inertialOffset = 0;
                    this.yaw_deg.inertialOffset = 0;
                }
            }
            super._checkInputs();
        }

        CalcPointerOffset(x, y):any {
            // FireFox doesn't support mEvent.offsetX/Y
            // so we do the simple calculation ourselves
            if (isPresent(this.renderCanvas)) {
                var canvasRect = this.renderCanvas.getBoundingClientRect();
                return {
                    x: x - canvasRect.left,
                    y: y - canvasRect.top
                };
            }
            return null;
        }

        CalcPosition() {
            var st:CameraState = this._getCurrState();

            var cameraMat:Matrix = Matrix.RotationYawPitchRoll(st.yaw_deg * Math.PI / 180,
                st.pitch_deg * Math.PI / 180,
                0);
            var cameraFwd:Vector3 = new Vector3(cameraMat.m[8], cameraMat.m[9], cameraMat.m[10]);
            var cameraOffset:Vector3 = cameraFwd.scale(-st.distance);
            this.position = cameraOffset.add(st.targetPos);
            var bp = 0;
        }

        GetTargetPos():Vector3 {
            return new Vector3(this.targetX.value, this.targetY.value, this.targetZ.value);
        }

        private _getCurrState():CameraState {
            var result:CameraState = new CameraState();
            result.targetPos = this.GetTargetPos();
            result.yaw_deg = this.yaw_deg.value;
            result.pitch_deg = this.pitch_deg.value;
            result.distance = this.distance.value;
            result.ortho = (this.mode == Camera.ORTHOGRAPHIC_CAMERA);
            result.orthoLeft = this.orthoLeft;
            result.orthoRight = this.orthoRight;
            result.orthoTop = this.orthoTop;
            result.orthoBottom = this.orthoBottom;
            return result;
        }

        private _restoreState(state:CameraState) {
            this.targetX.value = state.targetPos.x;
            this.targetY.value = state.targetPos.y;
            this.targetZ.value = state.targetPos.z;
            this.yaw_deg.value = state.yaw_deg;
            this.pitch_deg.value = state.pitch_deg;
            this.distance.value = state.distance;
            this.mode = (state.ortho ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA);
            this.orthoLeft = state.orthoLeft;
            this.orthoRight = state.orthoRight;
            this.orthoTop = state.orthoTop;
            this.orthoBottom = state.orthoBottom;
        }

        //
        //------------------ Update functions
        //
        /**
         * @override
         * Override Camera._initCache
         */
        _initCache() {
            super._initCache();
            this.cacheState = new CameraState();
        }

        /**
         * @override
         * Override Camera._updateCache
         */
        _updateCache(ignoreParentClass?: boolean) {
            if (!ignoreParentClass)
                super._updateCache();

            this.cacheState = this._getCurrState();
        }

        /**
         * @override
         * Override Camera._isSynchronizedViewMatrix
         */
        _isSynchronizedViewMatrix(): boolean {
            //checks position and upVector
            if (!super._isSynchronizedViewMatrix())
                return false;

            return this.cacheState.equals(this._getCurrState());
        }

        /**
         * @override
         * Override Camera._getViewMatrix
         */
        _getViewMatrix(): Matrix {
            // Recompute the camera position to match current values for
            // yaw, pitch, distance and targetPosition
            var bp = 0;
            this.CalcPosition();

            // Now compute view matrix
            //
            var viewMatrix:Matrix = new Matrix;
            Matrix.LookAtLHToRef(this.position,
                this.GetTargetPos(),
                this.upVector,
                viewMatrix);
            return viewMatrix;
        }

        private InertialStep(iv:InertialVar,
                             nSteps:number): void {
            // Inertia should decay at a fixed rate in *REAL* time. so ...
            //     nSteps == 1 when the app is running at 60 fps
            //     nSteps == 2 when running at 30 fps

            // https://en.wikipedia.org/wiki/Geometric_progression
            // The sum of a geometric progression of n terms
            //    sum(n) = a * (1 - power(r,n)) / (1 - r)
            //    sum(nSteps) = inertialOffset * (1 - power(inertia,nSteps)) / (1 -inertia)

            if (Math.abs(iv.inertialOffset) < Epsilon) {
                iv.inertialOffset = 0;
                return;
            }

            var enableInertia:boolean = false;
            if (enableInertia) {
                iv.value += iv.inertialOffset * (1 - Math.pow(this.inertia, nSteps)) / (1 - this.inertia);
                iv.inertialOffset *= Math.pow(this.inertia, nSteps);
            }
            else {
                iv.value += iv.inertialOffset;
                iv.inertialOffset = 0;
            }

            if (isPresent(iv.lowerLimit))
                iv.value = Math.max(iv.lowerLimit, iv.value);

            if (isPresent(iv.upperLimit))
                iv.value = Math.min(iv.upperLimit, iv.value);
        }

        //
        //------------------ End of Update functions
        //
        //------------------ Begin Event handlers
        //

        OnTumble(offsetX:number, offsetY:number) {
            // Tumble the camera
            // This rotates the camera about the target,
            // it does not pan and tilt the camera from a fixed position
            this.yaw_deg.inertialOffset += offsetX * 0.057 * this.tumbleSensitivity;
            this.pitch_deg.inertialOffset += offsetY * 0.057 * this.tumbleSensitivity;
        }

        OnTrack(offsetX:number, offsetY:number) {
            // Track the camera - move it horizontally and vertically in camera space
            //
            // The camera is rigidly attached to its target via the view vector.
            // So moving the camera really means moving its target.

            var xMove:number = offsetX * this.distance.value * 0.1 * (1/window.innerHeight) * this.trackSensitivity;
            var yMove:number = offsetY * this.distance.value * 0.1 * (1/window.innerHeight) * this.trackSensitivity;

            // We're moving the camera in its own coordinate system (where directly forward
            // is in the direction of the view vector (but that's dolly))
            var targetPos:Vector3 = this.GetTargetPos();
            var fwdVector:Vector3 = targetPos.subtract(this.position).normalize();
            var rightVector:Vector3 = Vector3.Cross(fwdVector, this.upVector).normalize();//offsetX moves along this vector
            var upVector:Vector3 = Vector3.Cross(rightVector, fwdVector);//offsetY moves along this vector

            var moveCameraRight:Vector3 = rightVector.scale(xMove);
            var moveCameraUp:Vector3 = upVector.scale(yMove);
            var cameraMove:Vector3 = moveCameraRight.add(moveCameraUp);//.add(moveCameraFwd);
            this.targetX.inertialOffset += cameraMove.x;
            this.targetY.inertialOffset += cameraMove.y;
            this.targetZ.inertialOffset += cameraMove.z;
        }

        OnPick(offsetX:number, offsetY:number, pickResult:PickingInfo, mEvent:MouseEvent) {
            if (!isPresent(pickResult.pickedPoint)) // Sanity check
                return;

            // Maintain the same distance from the camera to the target, if possible.
            // First, save current distance from camera to target
            var currDistance = this.distance.value;

            // Calculate the distance to the new target
            this.CalcPosition();
            var newTargetPos = pickResult.pickedPoint;
            var newLookatVec = new Vector3(null, null, null);
            newLookatVec.x = pickResult.pickedPoint.x - this.position.x;
            newLookatVec.y = pickResult.pickedPoint.y - this.position.y;
            newLookatVec.z = pickResult.pickedPoint.z - this.position.z;
            var newTargetDistance = newLookatVec.length();

            if (newTargetDistance < currDistance) {
                // console.log("TransitionCamera.OnPick use newTargetDistance");
                this.MoveCamera(pickResult.pickedPoint, newTargetDistance, null, null);
            }
            else {
                // console.log("TransitionCamera.OnPick use currDistance");
                this.MoveCamera(pickResult.pickedPoint, currDistance, null, null);
            }
        }

        OnDolly(offset:number) {
            if (this.mode == Camera.ORTHOGRAPHIC_CAMERA) {
                // Orthographic - 'zoom' the projection
                //
                var prevRadius:number = this.distance.value;
                var prevDiv:number = 1 / prevRadius;

                this.distance.inertialOffset = 0;
                this.distance.value *= (1 + offset);

                var currDiv:number = 1 / this.distance.value;
                var currOrthoWidth:number = this.orthoRight - this.orthoLeft;
                var currOrthoHeight:number = this.orthoTop - this.orthoBottom;
                var newOrthoWidth:number = currOrthoWidth * prevDiv / currDiv;
                var newOrthoHeight:number = currOrthoHeight * prevDiv / currDiv;

                var horzCentre:number = (this.orthoRight + this.orthoLeft) / 2;
                var vertCentre:number = (this.orthoTop + this.orthoBottom) / 2;
                this.orthoLeft = horzCentre - newOrthoWidth / 2;
                this.orthoRight = horzCentre + newOrthoWidth / 2;
                this.orthoTop = vertCentre + newOrthoHeight / 2;
                this.orthoBottom = vertCentre - newOrthoHeight / 2;
            }
            else // Perspective - dolly the camera
            {
                var dollyFactor:number = offset; //sanity for percentage zoom
                var dolly:number = this.distance.value * dollyFactor;
                ////if (dolly > 0)//moving away from target
                ////{
                ////	//limit maximum distance from target to reduce
                ////	//severity of back clipping plane problems
                ////	var maxRadius:number = this.maxZ * 0.75;
                ////	var curRadius:number = this.distance.value + this.distance.inertialOffset;
                ////	var maxDolly:number = Math.max(0,maxRadius - curRadius);
                ////	dolly = Math.min(dolly,maxDolly);
                ////}
                this.distance.inertialOffset += dolly;
            }
        }

        OnLeftClick() {
            this.ChangePerspectiveView(90, 5, null);
            return true;
        }

        OnRightClick() {
            this.ChangePerspectiveView(270, 5, null);
            return true;
        }

        OnFrontClick() {
            this.ChangePerspectiveView(0, 5, null);
            return true;
        }

        OnAftClick() {
            this.ChangePerspectiveView(180, 5, null);
            return true;
        }

        OnTopClick() {
            // Use reduced angle to reduce Z fighting, while looking 'straight down'
            this.ChangePerspectiveView(0, 87.5, null);
            return true;
        }

        OnBottomClick() {
            this.ChangePerspectiveView(180, -89.5, null);
            return true;
        }

        ChangePerspectiveView(yaw_deg:number, pitch_deg:number, distance:number) {
            var newState:CameraState = this._getCurrState();
            if (isPresent(yaw_deg))
                newState.yaw_deg = yaw_deg;
            if (isPresent(pitch_deg))
                newState.pitch_deg = pitch_deg;
            if (isPresent(distance))
                newState.distance = distance;
            newState.ortho = false;
            var currState:CameraState = this._getCurrState();
            if (currState.equals(newState))
                return; // nothing to change

            // Switch to the new view
            if (currState.ortho)
                this.StateChange(newState); // 'jump' from ortho to perspective
            else
                this.StateChangeAnimation(currState, newState); // Animate between perspective views
        }

        OnOrthoLeftClick() {
            // Looking east
            var AR:number = this.getEngine().getAspectRatio(this);
            this.OrthoView(90, 0, AR, 0, 0);
            return true;
        }

        OnOrthoRightClick() {
            // Looking west
            var AR:number = this.getEngine().getAspectRatio(this);
            this.OrthoView(270, 0, AR, 0, 0);
            return true;
        }

        OnOrthoFrontClick() {
            // Looking north
            var AR:number = this.getEngine().getAspectRatio(this);
            this.OrthoView(0, 0, AR, 0, 0);
            return true;
        }

        OnOrthoAftClick() {
            // Looking south
            var AR:number = this.getEngine().getAspectRatio(this);
            this.OrthoView(180, 0, AR, 0, 0);
            return true;
        }

        OnOrthoTopClick() {
            // Looking straight up
            var AR:number = this.getEngine().getAspectRatio(this);
            this.OrthoView(0, 89.9, AR, 0, 0);
            return true;
        }

        OnOrthoBottomClick() {
            // Looking straight down
            var AR:number = this.getEngine().getAspectRatio(this);
            this.OrthoView(180, -89.9, AR, 0, 0);
            return true;
        }

        OrthoView(yaw_deg:number, pitch_deg:number, AR:number, horzCentre:number, vertCentre:number) {
            var currState:CameraState = this._getCurrState();
            if (!currState.ortho) {
                // Switching from perspective to ortho view
                // Remember the current perspective view so that switching back to
                // perspective can return there
                this.perspectiveState = currState;
            }

            // Change to orthographic view
            // Zero the track positions to make sure we stay on screen
            var tanCameraFovAdj:number = 2.0 * Math.tan(this.fov);
            var orthoWidth:number = this.distance.value * tanCameraFovAdj;
            var orthoHeight:number = orthoWidth / AR;
            var orthoState:CameraState = CameraState.ctor(yaw_deg,
                pitch_deg,
                this.distance.value,
                this.GetTargetPos(),
                this.fov * 180 / Math.PI,
                true, //ortho
                horzCentre - orthoWidth / 2,//left
                horzCentre + orthoWidth / 2,//right
                vertCentre + orthoHeight / 2,//top
                vertCentre - orthoHeight / 2);//bottom
            this.StateChange(orthoState);
        }

        ToggleFullScreen() {
            this.getEngine().switchFullscreen(true);
            return true;
        }

        //
        //------------------ End of Event handlers
        //
        //------------------ Begin Animation
        //

        MoveCamera(_target:Vector3, _radius:number, _pitch_deg:number, _yaw_deg:number): void {
            var currState:CameraState = this._getCurrState();
            // If necessary, switch from orthographic to perspective
            if (currState.ortho) {
                currState.ortho = false;
                this.StateChange(currState); // 'jump' from ortho to perspective, same viewpoint
            }
            // Move the camera to the target position with animation
            if (isPresent(_target)) {
                this.MakeStateAnimation("targetX", "targetX.value", this.targetX.value, _target.x, this.nFrames);
                this.MakeStateAnimation("targetY", "targetY.value", this.targetY.value, _target.y, this.nFrames);
                this.MakeStateAnimation("targetZ", "targetZ.value", this.targetZ.value, _target.z, this.nFrames);
            }
            if (isPresent(_radius)) {
                this.MakeStateAnimation("distance", "distance.value", this.distance.value, _radius, this.nFrames);
            }
            if (isPresent(_pitch_deg)) {
                this.MakeStateAnimation("pitch_deg", "pitch_deg.value", this.pitch_deg.value, _pitch_deg, this.nFrames);
            }
            if (isPresent(_yaw_deg)) {
                // Avoid 'unwinding' behavior by forcing yaw values within 0 to 360
                var start_yaw = this.yaw_deg.value % 360;
                var end_yaw = _yaw_deg % 360;

                // Ensure the closest rotation
                if(Math.abs(start_yaw - end_yaw) > 180.0) {
                    if((start_yaw - end_yaw) > 0) {
                        start_yaw -= 360;
                    } else {
                        start_yaw += 360;
                    }
                }
                this.MakeStateAnimation("yaw_deg", "yaw_deg.value", start_yaw, end_yaw, this.nFrames);
            }
            if (this.animations.length > 0) {
                // Begin the animation with a callback to remove stopped animations afterwards
                this.getScene().beginAnimation(this, 0, this.nFrames, false, 1, () => {
                    // this.notifyMeshObservers();
                    this.animations = this.animations
                        .filter(an => !an.isStopped);
                });
            }
        }

        MakeStateAnimation(name:string, targetProperty:string, start:number, end:number, nFrames:number): void {
            if (MathTools.WithinEpsilon(start, end, 1e-6))
                return;
            var a:Animation = new Animation(name,
                targetProperty,
                this.fps,
                Animation.ANIMATIONTYPE_FLOAT,
                Animation.ANIMATIONLOOPMODE_CONSTANT);
            var keys:any = [];
            keys.push({frame: 0, value: start});
            keys.push({frame: nFrames, value: end});
            a.setKeys(keys);
            this.animations.push(a);
        }

        private StateChange(newState:CameraState): void {
            this.yaw_deg.value = newState.yaw_deg;
            this.yaw_deg.inertialOffset = 0;

            this.pitch_deg.value = newState.pitch_deg;
            this.pitch_deg.inertialOffset = 0;

            this.distance.value = newState.distance;
            this.distance.inertialOffset = 0;

            this.targetX.value = newState.targetPos.x;
            this.targetX.inertialOffset = 0;

            this.targetY.value = newState.targetPos.y;
            this.targetY.inertialOffset = 0;

            this.targetZ.value = newState.targetPos.z;
            this.targetZ.inertialOffset = 0;

            this.mode = (newState.ortho ? Camera.ORTHOGRAPHIC_CAMERA : Camera.PERSPECTIVE_CAMERA);
            this.orthoTop = newState.orthoTop;
            this.orthoBottom = newState.orthoBottom;
            this.orthoLeft = newState.orthoLeft;
            this.orthoRight = newState.orthoRight;
        }

        private StateChangeAnimation(startState:CameraState, endState:CameraState) {
            // Make yaw values within 0 to 360
            var start_yaw = startState.yaw_deg % 360;
            var end_yaw = endState.yaw_deg % 360;

            // Ensure the closest rotation
            if(Math.abs(start_yaw - end_yaw) > 180.0) {
                if((start_yaw - end_yaw) > 0) {
                    start_yaw -= 360;
                } else {
                    start_yaw += 360;
                }
            }
            this.MakeStateAnimation("yaw_deg", "yaw_deg.value", start_yaw, end_yaw, this.nFrames);
            this.MakeStateAnimation("pitch_deg", "pitch_deg.value", startState.pitch_deg, endState.pitch_deg, this.nFrames);
            this.MakeStateAnimation("distance", "distance.value", startState.distance, endState.distance, this.nFrames);
            this.MakeStateAnimation("targetX", "targetX.value", startState.targetPos.x, endState.targetPos.x, this.nFrames);
            this.MakeStateAnimation("targetY", "targetY.value", startState.targetPos.y, endState.targetPos.y, this.nFrames);
            this.MakeStateAnimation("targetZ", "targetZ.value", startState.targetPos.z, endState.targetPos.z, this.nFrames);

            // Begin the animation with a callback to remove stopped animations afterwards
            this.getScene().beginAnimation(this, 0, this.nFrames, false, 1, () => {
                // this.notifyMeshObservers();
                this.animations = this.animations
                    .filter(an => !an.isStopped);
            });
        }

        //------------------- End Animation

        public getClassName():string {
            return "TransitionCamera";
        }
    }
}


