
/* spellchecker: disable */

import { mat4, vec3 } from 'webgl-operate';

import {
    Camera,
    Canvas,
    Context,
    CuboidGeometry,
    DefaultFramebuffer,
    EyeTrackerDataStream,
    EyeTrackingStatusMessage,
    Invalidate,
    MouseEventProvider,
    Navigation,
    Program,
    Renderer,
    Shader,
    Wizard,
} from 'webgl-operate';

import { Demo } from '../demo';

/* spellchecker: enable */

// tslint:disable:max-classes-per-file


export class EyeTrackingRenderer extends Renderer {

    protected _camera: Camera;
    protected _navigation: Navigation;

    protected _cuboid: CuboidGeometry;

    protected _program: Program;
    protected _uViewProjection: WebGLUniformLocation;

    protected _defaultFBO: DefaultFramebuffer;

    protected _eyeTrackerDataStream: EyeTrackerDataStream;

    protected onUpdate(): boolean {

        // Update camera navigation (process events)
        this._navigation.update();
        return this._altered.any || this._camera.altered;
    }

    protected onPrepare(): void {
        if (this._altered.canvasSize) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
            this._camera.viewport = this._canvasSize;
        }

        if (this._altered.clearColor) {
            this._defaultFBO.clearColor(this._clearColor);
        }

        this._altered.reset();
        this._camera.altered = false;
    }

    protected onFrame(): void {
        const gl = this._context.gl;

        this._defaultFBO.bind();
        this._defaultFBO.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, true, false);

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.enable(gl.DEPTH_TEST);

        this._program.bind();
        gl.uniformMatrix4fv(this._uViewProjection, gl.GL_FALSE, this._camera.viewProjection);

        this._cuboid.bind();
        this._cuboid.draw();
        this._cuboid.unbind();

        this._program.unbind();

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);
    }

    protected onSwap(): void { }

    protected onInitialize(context: Context, callback: Invalidate,
        mouseEventProvider: MouseEventProvider,
        /* keyEventProvider: KeyEventProvider, */
        /* touchEventProvider: TouchEventProvider */): boolean {


        this._eyeTrackerDataStream = new EyeTrackerDataStream();

        this._eyeTrackerDataStream.onDataUpdate(() => {
            console.log(this._eyeTrackerDataStream.eyeTrackingData.toString());
        });

        this._eyeTrackerDataStream.onStatusUpdate(() => {
            switch (this._eyeTrackerDataStream.statusMessage) {
                case EyeTrackingStatusMessage.NewServerMessage:
                    console.log(this._eyeTrackerDataStream.serverMessage);
                    break;
                case EyeTrackingStatusMessage.BinaryMessageTooSmall:
                    console.log('Received stream from server with not enough bytes.');
                    break;
                default:
                    console.log('Eye-Tracking data stream in invalid state.');
                    break;
            }
        });

        this._eyeTrackerDataStream.dataStreams.gazePosition = true;
        this._eyeTrackerDataStream.dataStreams.gazeOrigin = true;
        this._eyeTrackerDataStream.dataStreams.eyePositionNormalized = true;
        this._eyeTrackerDataStream.dataStreams.headPositionAndRotation = true;
        this._eyeTrackerDataStream.dataStreams.userPresence = true;
        this._eyeTrackerDataStream.connect();

        this._defaultFBO = new DefaultFramebuffer(context, 'DefaultFBO');
        this._defaultFBO.initialize();
        this._defaultFBO.bind();

        const gl = context.gl;


        this._cuboid = new CuboidGeometry(context, 'Cuboid', true, [2.0, 2.0, 2.0]);
        this._cuboid.initialize();


        const vert = new Shader(context, gl.VERTEX_SHADER, 'mesh.vert');
        vert.initialize(require('./mesh.vert'));
        const frag = new Shader(context, gl.FRAGMENT_SHADER, 'mesh.frag');
        frag.initialize(require('./mesh.frag'));


        this._program = new Program(context, 'CubeProgram');
        this._program.initialize([vert, frag], false);

        this._program.attribute('a_vertex', this._cuboid.vertexLocation);
        this._program.attribute('a_texCoord', this._cuboid.uvCoordLocation);
        this._program.link();
        this._program.bind();


        this._uViewProjection = this._program.uniform('u_viewProjection');
        const identity = mat4.identity(mat4.create());
        gl.uniformMatrix4fv(this._program.uniform('u_model'), gl.FALSE, identity);
        gl.uniform1i(this._program.uniform('u_texture'), 0);
        gl.uniform1i(this._program.uniform('u_textured'), false);

        this._camera = new Camera();
        this._camera.center = vec3.fromValues(0.0, 0.0, 0.0);
        this._camera.up = vec3.fromValues(0.0, 1.0, 0.0);
        this._camera.eye = vec3.fromValues(0.0, 0.0, 5.0);
        this._camera.near = 1.0;
        this._camera.far = 8.0;


        this._navigation = new Navigation(callback, mouseEventProvider);
        this._navigation.camera = this._camera;

        return true;
    }

    protected onUninitialize(): void {
        super.uninitialize();

        this._cuboid.uninitialize();
        this._program.uninitialize();

        this._defaultFBO.uninitialize();
    }
}


export class EyeTrackingDemo extends Demo {

    private _canvas: Canvas;
    private _renderer: EyeTrackingRenderer;

    initialize(element: HTMLCanvasElement | string): boolean {

        this._canvas = new Canvas(element);
        this._canvas.controller.multiFrameNumber = 1;
        this._canvas.framePrecision = Wizard.Precision.float;
        this._canvas.clearColor.fromHex('d6d8db');
        this._canvas.frameScale = [1.0, 1.0];

        this._canvas.element.addEventListener('click', () => { this._canvas.controller.update(); });

        this._renderer = new EyeTrackingRenderer();
        this._canvas.renderer = this._renderer;

        return true;
    }

    uninitialize(): void {
        this._canvas.dispose();
        (this._renderer as Renderer).uninitialize();
    }

    get canvas(): Canvas {
        return this._canvas;
    }

    get renderer(): EyeTrackingRenderer {
        return this._renderer;
    }
}
