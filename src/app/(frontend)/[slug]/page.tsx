import { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React, { cache } from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { RequiredDataFromCollectionSlug } from 'payload'

import { generateMeta } from '@/utilities/generateMeta'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { RenderBlocks } from '@/blocks/RenderBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { homeStatic } from '@/endpoints/seed/home-static'
import PageClient from './page.client'

// Keep your Props type as is
type Props = {
  params: Promise<{
    slug?: string
  }>
}

const queryPageBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode() // Call draftMode() directly
  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'pages',
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: draft,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const pages = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return (
    pages.docs
      ?.filter((doc) => doc.slug && doc.slug !== 'home')
      .map(({ slug }) => ({
        slug: String(slug || ''),
      })) || []
  )
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  // --- FIX: Remove await ---
  const { slug = 'home' } = params
  const page = await queryPageBySlug({ slug })
  return generateMeta({ doc: page })
}

export default async function Page(props: Props) {
  const params = await props.params
  const { isEnabled: draft } = await draftMode() // Call draftMode() directly

  // --- FIX: Remove await ---
  const { slug = 'home' } = params
  const url = '/' + slug

  let page: RequiredDataFromCollectionSlug<'pages'> | null = await queryPageBySlug({
    slug,
  })

  // Remove this code once your website is seeded
  if (!page && slug === 'home') {
    page = homeStatic
  }

  if (!page) {
    // Use notFound() for clearer 404 handling if PayloadRedirects isn't essential here
    // or keep PayloadRedirects if it handles more complex redirect logic
    // notFound(); // <-- Consider using this if PayloadRedirects isn't needed for a simple 404
    return <PayloadRedirects url={url} /> // Keep if you need specific redirect logic
  }

  const { hero, layout } = page

  return (
    <article className="pt-16 pb-24">
      <PageClient />
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderBlocks blocks={layout} />
    </article>
  )
}
