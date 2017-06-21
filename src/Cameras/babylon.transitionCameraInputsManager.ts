/// <reference path="..\Cameras\babylon.cameraInputsManager.ts" />

module BABYLON {
    export class TransitionCameraInputsManager extends CameraInputsManager<TransitionCamera> {
        constructor(camera: TransitionCamera) {
            super(camera);
        }

        public addMouseWheel(): TransitionCameraInputsManager {
            this.add(new TransitionCameraMouseWheelInput());
            return this;
        }

        public addPointers(): TransitionCameraInputsManager {
            this.add(new TransitionCameraPointersInput());
            return this;
        }

        public addKeyboard(): TransitionCameraInputsManager {
            this.add(new TransitionCameraKeyboardMoveInput());
            return this;
        }
    }
}
