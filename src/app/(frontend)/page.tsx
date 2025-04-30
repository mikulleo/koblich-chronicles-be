import PageTemplate, { generateMetadata } from './[slug]/page'

export default async function HomePage() {
  return <PageTemplate params={{ slug: 'home' }} />
}

export { generateMetadata } from './[slug]/page'
