import type { DemoDocument } from '../types/domain.ts'

// Metadata only: there are no document contents, private identities or file uploads.
export const demoDocuments: DemoDocument[] = [
  { kind: 'nic', name: 'DEMO-NIC-front-and-back.pdf', sizeBytes: 1153434, format: 'pdf', simulated: true },
  { kind: 'driving-licence', name: 'DEMO-driving-licence.jpg', sizeBytes: 655360, format: 'jpg', simulated: true },
]
