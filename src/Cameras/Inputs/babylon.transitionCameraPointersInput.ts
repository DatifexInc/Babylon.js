module BABYLON {
    export enum PointersInputBtnID {
        none = -1,
        left = 0,
        middle = 1,
        right = 2,
        XButton1 = 3,
        XButton2 = 4
    }

    export class TransitionCameraPointersInput implements ICameraInput<TransitionCamera> {
        camera:TransitionCamera;

        private _pointerInput:(p:PointerInfo, s:EventState) => void;
        private _observer:Observer<PointerInfo>;
        private _onMouseMove:(e:MouseEvent) => any;
        private _onGestureStart:(e:PointerEvent) => void;
        private _onGesture:(e:MSGestureEvent) => void;
        private _MSGestureHandler:MSGesture;
        private _onContextMenu:(e:PointerEvent) => void;

        private _pointerId:any;
        private _buttonID:PointersInputBtnID; // Which mouse button was pushed
        private _altKey:boolean; // If altKey was depressed when mouse button was pushed
        private _previousPosition:Vector2;
        private _pointerDownPosition:Vector2;


        public attachControl(element:HTMLElement, noPreventDefault?:boolean) {
            var engine = this.camera.getEngine();

            this._pointerInput = (p, s) => {
                var evt = <PointerEvent>p.event;

                if (p.type === PointerEventTypes.POINTERDOWN) {
                    this._pointerId = evt.pointerId;
                    this._buttonID = evt.button;
                    this._altKey = evt.altKey;
                    this._previousPosition = new Vector2(evt.clientX, evt.clientY);
                    this._pointerDownPosition = new Vector2(evt.clientX, evt.clientY);
                    if (!noPreventDefault) {
                        evt.preventDefault();
                        element.focus();
                    }

                } else if (p.type === PointerEventTypes.POINTERUP) {
                    if (evt.button == this._buttonID &&
                        evt.button == PointersInputBtnID.right &&
                        this._pointerDownPosition.x == evt.clientX &&
                        this._pointerDownPosition.y == evt.clientY) {
                        //click w/o movement - treat as a pick if permited by app
                        var poff:Vector2 = this.camera.CalcPointerOffset(evt.clientX, evt.clientY);
                        if (poff) {
                            var pickResult:PickingInfo = this.camera.getScene().pick(poff.x, poff.y);
                            if (isPresent(pickResult.pickedMesh) &&
                                isPresent(pickResult.pickedPoint)) {
                                this.camera.OnPick(poff.x, poff.y, pickResult, evt);
                            }

                            // Log message
                            var debugMsg:String = "";
                            debugMsg += "TransitionCameraPointersInput.OnPointerUp poff[" + poff.x.toFixed(2) + "," + poff.y.toFixed(2) + "] ";
                            if (!isPresent(pickResult.pickedMesh)) {
                                debugMsg += "NO HIT";
                                console.log(debugMsg);
                            }
                            else {
                                debugMsg += " MESH " + pickResult.pickedMesh.name;
                                if (!isPresent(pickResult.pickedPoint)) {
                                    debugMsg += " NO HIT POINT.";
                                    console.log(debugMsg);
                                }
                                else {
                                    debugMsg += "  POINT ";
                                    debugMsg += String(pickResult.pickedPoint.x);
                                    debugMsg += " ";
                                    debugMsg += String(pickResult.pickedPoint.y);
                                    debugMsg += " ";
                                    debugMsg += String(pickResult.pickedPoint.z);
                                    console.log(debugMsg);
                                }
                            }
                        }
                    }

                    // Reset private variables for next time
                    this._previousPosition = null;
                    this._pointerDownPosition = null;
                    this._buttonID = null;
                    this._pointerId = null;
                    this._altKey = false;

                    if (!noPreventDefault) {
                        evt.preventDefault();
                    }

                } else if (p.type === PointerEventTypes.POINTERMOVE) {
                    if (!this._previousPosition)
                        return;
                    if (this._pointerId !== evt.pointerId)
                        return;

                    if (!noPreventDefault) {
                        evt.preventDefault();
                    }

                    var offsetX:number = evt.clientX - this._previousPosition.x;
                    var offsetY:number = evt.clientY - this._previousPosition.y;

                    switch (this._buttonID) {
                        case PointersInputBtnID.left:
                            // Track if ALT key is down or if in orthographic mode
                            // Otherwise tumble
                            if (this._altKey) {
                                this.camera.OnTrack(offsetX, offsetY);
                            } else if (this.camera.mode == Camera.ORTHOGRAPHIC_CAMERA) {
                                this.camera.OnTrack(offsetX, offsetY);
                                console.log('Pointer_MOVE ortho camera');
                            } else {
                                this.camera.OnTumble(offsetX, offsetY);
                            }
                            break;
                        case PointersInputBtnID.right:
                            this.camera.OnTrack(offsetX, offsetY);
                            break;
                        case PointersInputBtnID.middle:
                        case PointersInputBtnID.XButton1:
                        case PointersInputBtnID.XButton2:
                        default:
                            break;
                    }
                    this._previousPosition = new Vector2(evt.clientX, evt.clientY);
                }
            }

            this._observer = this.camera.getScene().onPointerObservable.add(this._pointerInput,
                PointerEventTypes.POINTERDOWN |
                PointerEventTypes.POINTERUP |
                PointerEventTypes.POINTERMOVE);

            this._onContextMenu = evt => {
                evt.preventDefault();
            };

            this._onMouseMove = evt => {
                if (!engine.isPointerLock) {
                    return;
                }
                console.log('   Mouse MOVE');
                if (!noPreventDefault) {
                    evt.preventDefault();
                }
            };

            this._onGestureStart = e => {
                if (window.MSGesture === undefined) {
                    return;
                }
                this._MSGestureHandler.addPointer(e.pointerId);
            };

            this._onGesture = e => {
                if (e.preventDefault) {
                    if (!noPreventDefault) {
                        e.stopPropagation();
                        e.preventDefault();
                    }
                }
            };

            element.addEventListener("mousemove", this._onMouseMove, false);
            element.addEventListener("MSPointerDown", this._onGestureStart, false);
            element.addEventListener("MSGestureChange", this._onGesture, false);
            element.addEventListener("contextmenu", this._onContextMenu, false);
        }

        public detachControl(element:HTMLElement) {
            if (element && this._observer) {
                this.camera.getScene().onPointerObservable.remove(this._observer);
                this._observer = null;
            }
            // Reset the private variables
            this._previousPosition = null;
            this._pointerDownPosition = null;
            this._buttonID = null;
            this._pointerId = null;
            this._altKey = false;
        }

        getTypeName():string {
            return "TransitionCameraPointersInput";
        }

        getSimpleName() {
            return "TransitionCameraPointers";
        }
    }

    CameraInputTypes["TransitionCameraPointersInput"] = TransitionCameraPointersInput;
}
