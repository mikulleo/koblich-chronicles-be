import PageTemplate, { generateMetadata as slughPageGenerateMetadata } from './[slug]/page'
import { Metadata } from 'next'

export default async function HomePage() {
  // Skip database queries during build time
  if (process.env.NODE_ENV === 'production' && !process.env.RAILWAY_STATIC_URL) {
    console.log('Skipping generateStaticParams in production build')
    return [] // Return empty array during build
  }

  return PageTemplate({ params: Promise.resolve({ slug: 'home' }) })
}

// Implement our own generateMetadata function for the home page
export async function generateMetadata(): Promise<Metadata> {
  // Reuse the slug page's generateMetadata function with 'home' as slug
  return slughPageGenerateMetadata({ params: Promise.resolve({ slug: 'home' }) })
}
