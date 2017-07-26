module BABYLON {
    export var TransitionCameraKeys = {
        MoveLeft: 'ArrowLeft',
        MoveRight: 'ArrowRight',
        MoveUp: 'ArrowUp',
        MoveDown: 'ArrowDown',
        DollyOut: '[',
        DollyIn: ']',
        LeftView: 'l',
        RightView: 'r',
        FrontView: 'f',
        BackView: 'b',
        TopView: 't',
        UnderneathView: 'u',
        OrthoLeftView: 'L',
        OrthoRightView: 'R',
        OrthoFrontView: 'F',
        OrthoBackView: 'B',
        OrthoTopView: 'T',
        OrthoUnderneathView: 'U',
        Fullscreen: 'A'
    }

    export class TransitionCameraKeyboardMoveInput implements ICameraInput<TransitionCamera> {
        camera:TransitionCamera;
        private _onKeyDown:(e:KeyboardEvent) => any;
        private _tumbleLeft:boolean;
        private _tumbleRight:boolean;
        private _tumbleUp:boolean;
        private _tumbleDown:boolean;
        private _trackLeft:boolean;
        private _trackRight:boolean;
        private _trackUp:boolean;
        private _trackDown:boolean;
        private _dollyOut:boolean;
        private _dollyIn:boolean;
        private _maxDollyOut:boolean;
        private _maxDollyIn:boolean;

        public attachControl(element:HTMLElement, noPreventDefault?:boolean) {
            element.tabIndex = 1;

            this._onKeyDown = evt => {
                var processed = false;
                var camera = this.camera;
                var useTrackForTumble:boolean = (evt.altKey || camera.mode == Camera.ORTHOGRAPHIC_CAMERA);

                // Navigation keys must be on KeyDown to enable key repeat
                switch (evt.key) {
                    case TransitionCameraKeys.MoveLeft:
                        (useTrackForTumble ? processed = this._trackLeft = true :
                            processed = this._tumbleLeft = true);
                        break;
                    case TransitionCameraKeys.MoveRight:
                        (useTrackForTumble ? processed = this._trackRight = true :
                            processed = this._tumbleRight = true);
                        break;
                    case TransitionCameraKeys.MoveUp:
                        (useTrackForTumble ? processed = this._trackUp = true :
                            processed = this._tumbleUp = true);
                        break;
                    case TransitionCameraKeys.MoveDown:
                        (useTrackForTumble ? processed = this._trackDown = true :
                            processed = this._tumbleDown = true);
                        break;
                    case TransitionCameraKeys.DollyOut:
                        if (evt.altKey && isPresent(camera.maxDistance))
                            processed = this._maxDollyOut = true;
                        else
                            processed = this._dollyOut = true;
                        break;
                    case TransitionCameraKeys.DollyIn:
                        if (evt.altKey && isPresent(camera.minDistance))
                            processed = this._maxDollyIn = true;
                        else
                            processed = this._dollyIn = true;
                        break;
                }

                // Single-event camera change
                switch (evt.key) {
                    case TransitionCameraKeys.LeftView:
                        processed = camera.OnLeftClick();
                        break;
                    case TransitionCameraKeys.RightView:
                        processed = camera.OnRightClick();
                        break;
                    case TransitionCameraKeys.FrontView:
                        processed = camera.OnFrontClick();
                        break;
                    case TransitionCameraKeys.BackView:
                        processed = camera.OnAftClick();
                        break;
                    case TransitionCameraKeys.TopView:
                        processed = camera.OnTopClick();
                        break;
                    case TransitionCameraKeys.UnderneathView:
                        processed = camera.OnBottomClick();
                        break;
                    case TransitionCameraKeys.OrthoLeftView:
                        processed = camera.OnOrthoLeftClick();
                        break;
                    case TransitionCameraKeys.OrthoRightView:
                        processed = camera.OnOrthoRightClick();
                        break;
                    case TransitionCameraKeys.OrthoFrontView:
                        processed = camera.OnOrthoFrontClick();
                        break;
                    case TransitionCameraKeys.OrthoBackView:
                        processed = camera.OnOrthoAftClick();
                        break;
                    case TransitionCameraKeys.OrthoTopView:
                        processed = camera.OnOrthoTopClick();
                        break;
                    case TransitionCameraKeys.OrthoUnderneathView:
                        processed = camera.OnOrthoBottomClick();
                        break;
                }

                // Full screen and pointer lock
                // https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
                // https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
                //
                //	A+shift to toggle full screen
                //
                switch (evt.key) {
                    case TransitionCameraKeys.Fullscreen:
                        processed = camera.ToggleFullScreen();
                        break;
                }

                // If this event was used, then prevent further processing of this event
                if (processed && evt.preventDefault) {
                    if (!noPreventDefault) {
                        evt.preventDefault();
                    }
                }
            };

            element.addEventListener("keydown", this._onKeyDown, false);
        }

        public detachControl(element:HTMLElement) {
            if (element) {
                element.removeEventListener("keydown", this._onKeyDown);
            }

            this._onKeyDown = null;
        }

        private _clearCmds(): void {
            this._tumbleLeft = false;
            this._tumbleRight = false;
            this._tumbleUp = false;
            this._tumbleDown = false;
            this._trackLeft = false;
            this._trackRight = false;
            this._trackUp = false;
            this._trackDown = false;
            this._dollyOut = false;
            this._dollyIn = false;
            this._maxDollyOut = false;
            this._maxDollyIn = false;
        }

        public checkInputs(): void {
            if (this._onKeyDown) {
                var camera = this.camera;

                if (this._tumbleLeft)
                    camera.OnTumble(-3, 0);
                if (this._tumbleRight)
                    camera.OnTumble(+3, 0);
                if (this._tumbleUp)
                    camera.OnTumble(0, -3);
                if (this._tumbleDown)
                    camera.OnTumble(0, +3);
                if (this._trackLeft)
                    camera.OnTrack(-10, 0);
                if (this._trackRight)
                    camera.OnTrack(+10, 0);
                if (this._trackUp)
                    camera.OnTrack(0, -10);
                if (this._trackDown)
                    camera.OnTrack(0, +10);
                if (this._dollyOut)
                    camera.OnDolly(+0.05);
                if (this._dollyIn)
                    camera.OnDolly(-0.05);
                if (this._maxDollyOut)
                    camera.OnDolly(+9999999);
                if (this._maxDollyIn)
                    camera.OnDolly(-9999999);

                this._clearCmds();
            }
        }

        getTypeName(): string {
            return "TransitionCameraKeyboardMoveInput";
        }

        getSimpleName(): string {
            return "TransitionCameraKeyboard";
        }
    }

    CameraInputTypes["TransitionCameraKeyboardMoveInput"] = TransitionCameraKeyboardMoveInput;
}