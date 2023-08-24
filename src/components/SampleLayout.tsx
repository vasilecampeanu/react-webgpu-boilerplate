import { FC, useEffect, useRef } from "react";

const init = async (canvas: HTMLCanvasElement) => {
    // WebGPU device initialization
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter) {
        throw new Error("No appropriate GPUAdapter found.");
    }

    const device = await adapter.requestDevice();

    // Canvas configuration
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    context?.configure({
        device: device,
        format: canvasFormat,
    });

    // Create a buffer with the vertices for a single cell.
    const vertices = new Float32Array([
        //   X,    Y
        -0.8, -0.8, // Triangle 1
        0.8, -0.8,
        0.8, 0.8,

        -0.8, -0.8, // Triangle 2
        0.8, 0.8,
        -0.8, 0.8,
    ]);

    const vertexBuffer = device.createBuffer({
        label: "Cell vertices",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
        arrayStride: 8,
        attributes: [{
            format: "float32x2",
            offset: 0,
            shaderLocation: 0, // Position. Matches @location(0) in the @vertex shader.
        }],
    };

    // Create the shader that will render the cells.
    const cellShaderModule = device.createShaderModule({
        label: "Cell shader",
        code: `
            @vertex
            fn vertexMain(@location(0) position: vec2f)
              -> @builtin(position) vec4f {
              return vec4f(position, 0, 1);
            }
  
            @fragment
            fn fragmentMain() -> @location(0) vec4f {
              return vec4f(1, 0, 0, 1);
            }
          `
    });

    // Create a pipeline that renders the cell.
    const cellPipeline = device.createRenderPipeline({
        label: "Cell pipeline",
        layout: "auto",
        vertex: {
            module: cellShaderModule,
            entryPoint: "vertexMain",
            buffers: [vertexBufferLayout as GPUVertexBufferLayout]
        },
        fragment: {
            module: cellShaderModule,
            entryPoint: "fragmentMain",
            targets: [{
                format: canvasFormat
            }]
        }
    });

    // Clear the canvas with a render pass
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context?.getCurrentTexture().createView() as GPUTextureView,
            loadOp: "clear" as GPULoadOp,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: "store" as GPUStoreOp,
        }]
    });
    
    // Draw the square.
    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2);

    pass.end();

    device.queue.submit([encoder.finish()]);
}

export const SampleLayout: FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        init(canvasRef.current as HTMLCanvasElement)
    }, [])

    return (
        <div className="sample-layout">
            <canvas ref={canvasRef} width="512" height="512"></canvas>
        </div>
    )
}
