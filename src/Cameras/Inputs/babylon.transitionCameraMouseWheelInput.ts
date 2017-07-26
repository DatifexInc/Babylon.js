module BABYLON {
    export class TransitionCameraMouseWheelInput implements ICameraInput<TransitionCamera> {
        camera: TransitionCamera;

        private _wheel: (p: PointerInfo, s: EventState) => void;
        private _observer: Observer<PointerInfo>;

        @serialize()
        public wheelPrecision = 3.0;

        public attachControl(element: HTMLElement, noPreventDefault?: boolean) {
            this._wheel = (p, s) => {

                // Double check the event type
                if (p.type !== PointerEventTypes.POINTERWHEEL) return;

                var wheelFactor: number = 0;
                var event = <MouseWheelEvent>p.event;
                if (event.wheelDelta) {
                    // Always take one step no matter how much rotation has built up
                    // Otherwise you can get way ahead of a slow browser
                    //
                    wheelFactor = -MathTools.Sign(event.wheelDelta) / 20;
                }
                else if (event.detail) {
                    wheelFactor = event.detail / (this.wheelPrecision * 10);
                }
                if (wheelFactor == 0)
                    return;

                if (event.preventDefault) {
                    if (!noPreventDefault) {
                        event.preventDefault();
                    }
                }

                this.camera.OnDolly(wheelFactor);
            };

            this._observer = this.camera.getScene().onPointerObservable.add(this._wheel, PointerEventTypes.POINTERWHEEL);
        }

        public detachControl(element: HTMLElement) {
            if (this._observer && element) {
                this.camera.getScene().onPointerObservable.remove(this._observer);
                this._observer = null;
                this._wheel = null;
            }
        }

        getTypeName(): string {
            return "TransitionCameraMouseWheelInput";
        }

        getSimpleName(): string {
            return "mousewheel";
        }
    }

    CameraInputTypes["TransitionCameraMouseWheelInput"] = TransitionCameraMouseWheelInput;
}
