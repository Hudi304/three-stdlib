import { BufferGeometry, Mesh, Points } from 'three'

/**
 * Export draco compressed files from threejs geometry objects.
 *
 * Draco files are compressed and usually are smaller than conventional 3D file formats.
 *
 * The exporter receives a options object containing
 *  - decodeSpeed, indicates how to tune the encoder regarding decode speed (0 gives better speed but worst quality)
 *  - encodeSpeed, indicates how to tune the encoder parameters (0 gives better speed but worst quality)
 *  - encoderMethod
 *  - quantization, indicates the presision of each type of data stored in the draco file in the order (POSITION, NORMAL, COLOR, TEX_COORD, GENERIC)
 *  - exportUvs
 *  - exportNormals
 */

const DRACOExporter = /* @__PURE__ */ (() => {
  class DRACOExporter {
    // Encoder methods

    static MESH_EDGEBREAKER_ENCODING = 1
    static MESH_SEQUENTIAL_ENCODING = 0

    // Geometry type

    static POINT_CLOUD = 0
    static TRIANGULAR_MESH = 1

    // Attribute type
    static INVALID = -1
    static POSITION = 0
    static NORMAL = 1
    static COLOR = 2
    static TEX_COORD = 3
    static GENERIC = 4

    parse(
      object,
      options = {
        decodeSpeed: 5,
        encodeSpeed: 5,
        encoderMethod: DRACOExporter.MESH_EDGEBREAKER_ENCODING,
        quantization: [16, 8, 8, 8, 8],
        exportUvs: true,
        exportNormals: true,
        exportColor: false,
      },
    ) {
      if (object instanceof BufferGeometry && object.isBufferGeometry) {
        throw new Error('DRACOExporter: The first parameter of parse() is now an instance of Mesh or Points.')
      }

      if (DracoEncoderModule === undefined) {
        throw new Error('THREE.DRACOExporter: required the draco_encoder to work.')
      }

      const geometry = object.geometry

      const dracoEncoder = DracoEncoderModule()
      const encoder = new dracoEncoder.Encoder()
      let builder
      let dracoObject

      if (!geometry.isBufferGeometry) {
        throw new Error(
          'THREE.DRACOExporter.parse(geometry, options): geometry is not a THREE.BufferGeometry instance.',
        )
      }

      if (object instanceof Mesh && object.isMesh) {
        builder = new dracoEncoder.MeshBuilder()
        dracoObject = new dracoEncoder.Mesh()

        const vertices = geometry.getAttribute('position')
        // @ts-ignore
        builder.AddFloatAttributeToMesh(
          dracoObject,
          dracoEncoder.POSITION,
          vertices.count,
          vertices.itemSize,
          vertices.array,
        )

        const faces = geometry.getIndex()

        if (faces !== null) {
          builder.AddFacesToMesh(dracoObject, faces.count / 3, faces.array)
        } else {
          const faces = new (vertices.count > 65535 ? Uint32Array : Uint16Array)(vertices.count)

          for (let i = 0; i < faces.length; i++) {
            faces[i] = i
          }

          builder.AddFacesToMesh(dracoObject, vertices.count, faces)
        }

        if (options.exportNormals) {
          const normals = geometry.getAttribute('normal')

          if (normals !== undefined) {
            // @ts-ignore
            builder.AddFloatAttributeToMesh(
              dracoObject,
              dracoEncoder.NORMAL,
              normals.count,
              normals.itemSize,
              normals.array,
            )
          }
        }

        if (options.exportUvs) {
          const uvs = geometry.getAttribute('uv')

          if (uvs !== undefined) {
            // @ts-ignore
            builder.AddFloatAttributeToMesh(dracoObject, dracoEncoder.TEX_COORD, uvs.count, uvs.itemSize, uvs.array)
          }
        }

        if (options.exportColor) {
          const colors = geometry.getAttribute('color')

          if (colors !== undefined) {
            // @ts-ignore
            builder.AddFloatAttributeToMesh(
              dracoObject,
              dracoEncoder.COLOR,
              colors.count,
              colors.itemSize,
              colors.array,
            )
          }
        }
      } else if (object instanceof Points && object.isPoints) {
        // @ts-ignore
        builder = new dracoEncoder.PointCloudBuilder()
        // @ts-ignore
        dracoObject = new dracoEncoder.PointCloud()

        const vertices = geometry.getAttribute('position')
        builder.AddFloatAttribute(dracoObject, dracoEncoder.POSITION, vertices.count, vertices.itemSize, vertices.array)

        if (options.exportColor) {
          const colors = geometry.getAttribute('color')

          if (colors !== undefined) {
            builder.AddFloatAttribute(dracoObject, dracoEncoder.COLOR, colors.count, colors.itemSize, colors.array)
          }
        }
      } else {
        throw new Error('DRACOExporter: Unsupported object type.')
      }

      //Compress using draco encoder

      const encodedData = new dracoEncoder.DracoInt8Array()

      //Sets the desired encoding and decoding speed for the given options from 0 (slowest speed, but the best compression) to 10 (fastest, but the worst compression).

      const encodeSpeed = options.encodeSpeed !== undefined ? options.encodeSpeed : 5
      const decodeSpeed = options.decodeSpeed !== undefined ? options.decodeSpeed : 5

      encoder.SetSpeedOptions(encodeSpeed, decodeSpeed)

      // Sets the desired encoding method for a given geometry.

      if (options.encoderMethod !== undefined) {
        encoder.SetEncodingMethod(options.encoderMethod)
      }

      // Sets the quantization (number of bits used to represent) compression options for a named attribute.
      // The attribute values will be quantized in a box defined by the maximum extent of the attribute values.
      if (options.quantization !== undefined) {
        for (let i = 0; i < 5; i++) {
          if (options.quantization[i] !== undefined) {
            encoder.SetAttributeQuantization(i, options.quantization[i])
          }
        }
      }

      let length

      if (object instanceof Mesh && object.isMesh) {
        length = encoder.EncodeMeshToDracoBuffer(dracoObject, encodedData)
      } else {
        // @ts-ignore
        length = encoder.EncodePointCloudToDracoBuffer(dracoObject, true, encodedData)
      }

      dracoEncoder.destroy(dracoObject)

      if (length === 0) {
        throw new Error('THREE.DRACOExporter: Draco encoding failed.')
      }

      //Copy encoded data to buffer.
      const outputData = new Int8Array(new ArrayBuffer(length))

      for (let i = 0; i < length; i++) {
        outputData[i] = encodedData.GetValue(i)
      }

      dracoEncoder.destroy(encodedData)
      dracoEncoder.destroy(encoder)
      dracoEncoder.destroy(builder)

      return outputData
    }
  }

  return DRACOExporter
})()

export { DRACOExporter }
