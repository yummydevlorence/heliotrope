import { supabase } from '../supabase'

const MODEL_URLS = ['/models/', 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/']
export const MATCH = 0.5
const SAME_PERSON = 0.6
const MAX_SIDE = 640
let ready

async function loadFrom(faceapi, uri) {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(uri),
    faceapi.nets.faceLandmark68Net.loadFromUri(uri),
    faceapi.nets.faceRecognitionNet.loadFromUri(uri),
  ])
}

export function loadModels() {
  if (!ready) {
    ready = import('@vladmandic/face-api').then(async (faceapi) => {
      let lastError
      for (const uri of MODEL_URLS) {
        try {
          await loadFrom(faceapi, uri)
          return faceapi
        } catch (loadError) {
          lastError = loadError
        }
      }
      throw lastError
    })
    ready.catch(() => {
      ready = undefined
    })
  }
  return ready
}

async function toCanvas(blob) {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close?.()
    throw new Error('Unable to prepare image for face detection.')
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return canvas
}

async function describe(faceapi, blob) {
  const canvas = await toCanvas(blob)
  const faces = await faceapi
    .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()
  if (faces.length === 0) return { message: 'No face found. Face the camera in good light.' }
  if (faces.length > 1) return { message: 'More than one face found. Only you should be in the photo.' }
  return { descriptor: Array.from(faces[0].descriptor) }
}

export async function getSavedDescriptors(userId) {
  const { data, error } = await supabase
    .from('face_profiles')
    .select('descriptors,descriptor')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) return []
  if (Array.isArray(data.descriptors) && data.descriptors.length) return data.descriptors
  return data.descriptor ? [Array.from(data.descriptor)] : []
}

export async function hasFaceProfile(userId) {
  try {
    return (await getSavedDescriptors(userId)).length > 0
  } catch (profileError) {
    console.error('Unable to read face profile:', profileError)
    return null
  }
}

export async function enrollFace(blobs, userId) {
  if (blobs.length < 3) return { ok: false, message: 'Please add all 3 reference photos.' }
  let faceapi
  try {
    faceapi = await loadModels()
  } catch (loadError) {
    console.error('Face models failed to load:', loadError)
    return { ok: false, message: 'Face check could not load. Check your internet and try again.' }
  }

  const descriptors = []
  for (let index = 0; index < blobs.length; index += 1) {
    let result
    try {
      result = await describe(faceapi, blobs[index])
    } catch (detectionError) {
      console.error(`Face detection failed for enrollment photo ${index + 1}:`, detectionError)
      return { ok: false, message: `Photo ${index + 1}: Could not check that photo. Try another one.` }
    }
    if (result.message) return { ok: false, message: `Photo ${index + 1}: ${result.message}` }
    descriptors.push(result.descriptor)
  }

  for (let index = 1; index < descriptors.length; index += 1) {
    if (faceapi.euclideanDistance(descriptors[0], descriptors[index]) > SAME_PERSON) {
      return { ok: false, message: `Photo ${index + 1} looks like a different person. Start over with clear photos of you.` }
    }
  }

  const { error } = await supabase
    .from('face_profiles')
    .upsert({ user_id: userId, descriptors, descriptor: descriptors[0] })
  if (error) {
    console.error('Unable to save face profile:', error)
    return { ok: false, message: 'Could not save your face. Check the face_profiles policies.' }
  }
  return { ok: true }
}

export async function checkFace(blob, userId) {
  let faceapi
  try {
    faceapi = await loadModels()
  } catch (loadError) {
    console.error('Face models failed to load:', loadError)
    return { ok: false, message: 'Face check could not load. Check your internet and try again.' }
  }

  let saved
  try {
    saved = await getSavedDescriptors(userId)
  } catch (profileError) {
    console.error('Unable to read face profile:', profileError)
    return { ok: false, message: 'Could not read your saved face. Check the face_profiles table.' }
  }
  if (saved.length === 0) {
    return { ok: false, needsEnroll: true, message: 'Add your face photo first.' }
  }

  let result
  try {
    result = await describe(faceapi, blob)
  } catch (detectionError) {
    console.error('Face detection failed:', detectionError)
    return { ok: false, message: 'Could not check that photo. Try another one.' }
  }
  if (result.message) return { ok: false, message: result.message }

  const distance = Math.min(...saved.map((reference) => faceapi.euclideanDistance(reference, result.descriptor)))
  if (distance > MATCH) {
    return { ok: false, message: 'Face not recognized. Try again, or retake in better light.' }
  }
  return { ok: true }
}
