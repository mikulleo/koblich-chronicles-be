import PageTemplate, { generateMetadata as slughPageGenerateMetadata } from './[slug]/page'
import { Metadata } from 'next'

export default async function HomePage() {
  return PageTemplate({ params: Promise.resolve({ slug: 'home' }) })
}

// Implement our own generateMetadata function for the home page
export async function generateMetadata(): Promise<Metadata> {
  // Reuse the slug page's generateMetadata function with 'home' as slug
  return slughPageGenerateMetadata({ params: Promise.resolve({ slug: 'home' }) })
}
