import { supabase } from '../supabase'

// Models are fetched once from the CDN when the first selfie is checked.
const MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'
const MATCH = 0.5 // lower = stricter (0.6 is the library default)
let ready

function loadModels() {
  ready ||= import('@vladmandic/face-api').then(async (faceapi) => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODELS),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS),
    ])
    return faceapi
  })
  ready.catch(() => {
    ready = undefined
  })
  return ready
}

// Returns { ok, message?, enrolled? }.
// First selfie from a user saves their face; every later selfie must match it.
export async function checkFace(blob, userId) {
  let faceapi
  try {
    faceapi = await loadModels()
  } catch (loadError) {
    console.error('Face models failed to load:', loadError)
    return { ok: false, message: 'Face check could not load. Check your internet and try again.' }
  }

  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d').drawImage(bitmap, 0, 0)

  const faces = await faceapi
    .detectAllFaces(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors()
  if (faces.length === 0) return { ok: false, message: 'No face found. Face the camera in good light.' }
  if (faces.length > 1) return { ok: false, message: 'Face not recognized. Only one face per selfie.' }
  const descriptor = Array.from(faces[0].descriptor)

  const { data, error } = await supabase
    .from('face_profiles')
    .select('descriptor')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.error('Unable to read face profile:', error)
    return { ok: false, message: 'Could not read your saved face. Check the face_profiles table.' }
  }

  if (!data) {
    const { error: saveError } = await supabase.from('face_profiles').upsert({ user_id: userId, descriptor })
    if (saveError) {
      console.error('Unable to save face profile:', saveError)
      return { ok: false, message: 'Could not save your face. Check the face_profiles policies.' }
    }
    return { ok: true, enrolled: true }
  }

  const distance = faceapi.euclideanDistance(data.descriptor, descriptor)
  if (distance > MATCH) return { ok: false, message: 'Face not recognized. Try again, or retake in better light.' }
  return { ok: true }
}