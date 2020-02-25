
import { assert } from './auxiliaries';
import { Camera } from './camera';
import { Context } from './context';
import { Initializable } from './initializable';
import { NdcFillingTriangle } from './ndcfillingtriangle';
import { Program } from './program';
import { Shader } from './shader';
import { Texture2D } from './texture2d';
import { TextureCube } from './texturecube';
import { Wizard } from './wizard';


/**
 * This pass renders an environment from a texture in a single screen-space pass.
 */
export class EnvironmentRenderingPass extends Initializable {

    /**
     * Context, used to get context information and WebGL API access.
     */
    protected _context: Context;

    protected _environmentTexture: Texture2D | TextureCube | undefined;
    protected _environmentTexture2: Texture2D | undefined;
    protected _environmenTextureType: EnvironmentTextureType;
    protected _camera: Camera | undefined;

    protected _cubeMapProgram: Program;
    protected _equiMapProgram: Program;
    protected _sphereMapProgram: Program;
    protected _polarMapProgram: Program;

    protected _ndcTriangle: NdcFillingTriangle;
    protected _emptyTexture: Texture2D;
    protected _emptyCubemap: TextureCube;

    constructor(context: Context) {
        super();
        this._context = context;

        this._cubeMapProgram = new Program(context, 'CubemapEnvironmentProgram');
        this._equiMapProgram = new Program(context, 'EquimapEnvironmentProgram');
        this._polarMapProgram = new Program(context, 'PolarmapEnvironmentProgram');
        this._sphereMapProgram = new Program(context, 'SpheremapEnvironmentProgram');

        this._ndcTriangle = new NdcFillingTriangle(this._context, 'EnvironmentNdcTriangle');
        this._emptyTexture = new Texture2D(this._context, 'EmptyTexture');
        this._emptyCubemap = new TextureCube(this._context, 'EmptyCube');
    }

    @Initializable.initialize()
    initialize(): boolean {

        const gl = this._context.gl;

        this._ndcTriangle.initialize();

        const internalFormatAndType = Wizard.queryInternalTextureFormat(this._context, gl.RGB, Wizard.Precision.byte);
        this._emptyTexture.initialize(1, 1, internalFormatAndType[0], gl.RGB, internalFormatAndType[1]);
        this._emptyCubemap.initialize(1, internalFormatAndType[0], gl.RGB, internalFormatAndType[1]);

        /**
         * Compile a program for each projection type.
         */
        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'glyph.vert');
        vert.initialize(require(`./shaders/env-projections.vert`));
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'glyph.frag');
        frag.initialize(require(`./shaders/env-projections.frag`), false);

        frag.replace('PROJECTION_TYPE', 'CUBE_MAP');
        frag.compile();

        this._cubeMapProgram.initialize([vert, frag], false);
        this._cubeMapProgram.attribute('a_vertex', this._ndcTriangle.vertexLocation);
        this._cubeMapProgram.link();
        this._cubeMapProgram.bind();
        gl.uniform1i(this._cubeMapProgram.uniform('u_cubemap'), 0);
        this._cubeMapProgram.unbind();

        frag.replace('PROJECTION_TYPE', 'EQUI_MAP');
        frag.compile();

        this._equiMapProgram.initialize([vert, frag], false);
        this._equiMapProgram.attribute('a_vertex', this._ndcTriangle.vertexLocation);
        this._equiMapProgram.link();
        this._equiMapProgram.bind();
        gl.uniform1i(this._equiMapProgram.uniform('u_equirectmap'), 0);
        this._equiMapProgram.unbind();

        frag.replace('PROJECTION_TYPE', 'SPHERE_MAP');
        frag.compile();

        this._sphereMapProgram.initialize([vert, frag], false);
        this._sphereMapProgram.attribute('a_vertex', this._ndcTriangle.vertexLocation);
        this._sphereMapProgram.link();
        this._sphereMapProgram.bind();
        gl.uniform1i(this._sphereMapProgram.uniform('u_spheremap'), 0);
        this._sphereMapProgram.unbind();

        frag.replace('PROJECTION_TYPE', 'POLAR_MAP');
        frag.compile();

        this._polarMapProgram.initialize([vert, frag], false);
        this._polarMapProgram.attribute('a_vertex', this._ndcTriangle.vertexLocation);
        this._polarMapProgram.link();
        this._polarMapProgram.bind();
        gl.uniform1iv(this._polarMapProgram.uniform('u_polarmap'), [0, 1]);
        this._polarMapProgram.unbind();

        return true;
    }

    @Initializable.uninitialize()
    uninitialize(): void {
        this._cubeMapProgram.uninitialize();
        this._equiMapProgram.uninitialize();
        this._sphereMapProgram.uninitialize();
        this._polarMapProgram.uninitialize();
    }

    update(): void {

    }

    frame(): void {
        const gl = this._context.gl;

        assert(this._camera !== undefined, `Camera is undefined in environment rendering pass.`);
        assert(this._environmentTexture !== undefined,
            `Environment texture is undefined in environment rendering pass.`);

        let program = this._cubeMapProgram;

        if (this._environmenTextureType === EnvironmentTextureType.EquirectangularMap) {
            assert(this._environmentTexture instanceof Texture2D, `Input texture expected to be Texture2D for equirectangular mapping.`);
            this._environmentTexture!.bind(gl.TEXTURE0);
            program = this._equiMapProgram;
        } else if (this._environmenTextureType === EnvironmentTextureType.SphereMap) {
            assert(this._environmentTexture instanceof Texture2D, `Input texture expected to be Texture2D for sphere mapping.`);
            this._environmentTexture!.bind(gl.TEXTURE0);
            program = this._sphereMapProgram;
        } else if (this._environmenTextureType === EnvironmentTextureType.CubeMap) {
            assert(this._environmentTexture instanceof TextureCube, `Input texture expected to be a TextureCube for cube mapping.`);
            this._environmentTexture!.bind(gl.TEXTURE0);
            program = this._cubeMapProgram;
        } else if (this._environmenTextureType === EnvironmentTextureType.PolarMap) {
            assert(this._environmentTexture2 !== undefined, `Two input textures expected for polar mapping.`);
            assert(this._environmentTexture instanceof Texture2D, `Input texture expected to be a Texture2D for polar mapping.`);
            assert(this._environmentTexture2 instanceof Texture2D, `Input texture expected to be a Texture2D for polar mapping.`);
            this._environmentTexture!.bind(gl.TEXTURE0);
            this._environmentTexture2!.bind(gl.TEXTURE1);
            program = this._polarMapProgram;
        }

        program.bind();

        gl.uniformMatrix4fv(program.uniform('u_viewProjectionInverse'), false, this._camera!.viewProjectionInverse);

        this._ndcTriangle.bind();
        this._ndcTriangle.draw();

        program.unbind();
    }

    set environmentTextureType(type: EnvironmentTextureType) {
        this._environmenTextureType = type;
    }

    set environmentTexture(texture: Texture2D | TextureCube) {
        this._environmentTexture = texture;
    }

    set environmentTexture2(texture: Texture2D) {
        this._environmentTexture2 = texture;
    }

    set camera(camera: Camera) {
        this._camera = camera;
    }

}

export enum EnvironmentTextureType {
    CubeMap = 0,
    EquirectangularMap = 1,
    SphereMap = 2,
    PolarMap = 3,
}
