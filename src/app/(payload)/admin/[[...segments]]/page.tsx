/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import type { Metadata } from 'next'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = async (props: Args): Promise<Metadata> => {
  const params = await props.params
  const transformedParams = Promise.resolve(
    Object.fromEntries(params.segments.map((value, index) => [`${index}`, value])),
  )
  const transformedSearchParams = Promise.resolve(props.searchParams)
  return generatePageMetadata({
    config,
    params: transformedParams,
    searchParams: transformedSearchParams,
  })
}

const Page = async (props: Args) => {
  const searchParams = Promise.resolve(props.searchParams)
  const params = Promise.resolve(props.params)
  return RootPage({ config, params, searchParams, importMap })
}

export default Page
