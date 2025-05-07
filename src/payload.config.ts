// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'

import sharp from 'sharp' // sharp-import
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

// Import collections
import { Categories } from '@/collections/Categories'
import { Media } from '@/collections/Media'
import { Pages } from '@/collections/Pages'
import { Posts } from '@/collections/Posts'
import { Users } from '@/collections/Users'
import { Tags } from '@/collections/Tags'
import { Tickers } from '@/collections/Tickers'
import { Charts } from '@/collections/Charts'
import { Trades } from '@/collections/Trades'
import { Donations } from '@/collections/Donations'
import { Footer } from '@/Footer/config'
import { Header } from '@/Header/config'
import { plugins } from '@/plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { lexicalEditor } from '@payloadcms/richtext-lexical' // Claude add
import { getServerSideURL } from '@/utilities/getURL'

// Import admin customizations
//import { createStatsPage } from './admin/stats';

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const PAYLOAD_SECRET =
  process.env.PAYLOAD_SECRET || 'temporary_secret_for_build_only_not_for_production'

export default buildConfig({
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeLogin` statement on line 15.
      beforeLogin: ['@/components/BeforeLogin'],
      // The `BeforeDashboard` component renders the 'welcome' block that you see after logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below and the import `BeforeDashboard` statement on line 15.
      beforeDashboard: ['@/components/BeforeDashboard'],
      // Add our custom stats navigation link
      afterNavLinks: ['@/components/StatsNavLink'],
      // Add custom admin components - Claude addition
      /* views: {
        Statistics: createStatsPage(),
      }, 
      css: path.resolve(__dirname, 'admin/scss/custom.scss'), */
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      url: 'https://koblich-chronicles-be-production.up.railway.app',
      collections: ['pages', 'trades', 'media'],
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // Connection pool configuration to prevent transaction timeouts
      max: 10, // Maximum number of connections in the pool
      idleTimeoutMillis: 30000, // How long a connection can remain idle before being closed
      connectionTimeoutMillis: 5000, // How long to wait for a connection
      statement_timeout: 30000, // Terminate any statement that takes more than 30 seconds
      allowExitOnIdle: true, // Allow the pool to exit cleanly
    },
  }),
  collections: [Pages, Posts, Media, Categories, Users, Tags, Tickers, Charts, Trades, Donations],
  cors: {
    origins: [
      getServerSideURL(),
      process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'https://host.plasmicdev.com',
      'https://koblich-chronicles-fe-3g6s-leos-mikulkas-projects.vercel.app',
      'https://koblich-chronicles-fe-3g6s.vercel.app',
      'https://www.koblich-chronicles.com',
      // Add any additional domains you need
    ].filter(Boolean),
    headers: ['Content-Range', 'X-Total-Count'],
  },
  globals: [Header, Footer],
  /*meta: {
    titleSuffix: '- Koblich Chronicles',
    favicon: '/assets/favicon.ico',
    ogImage: '/assets/og-image.jpg',
  }, Claude addition */
  plugins: [
    ...plugins,
    //storage-adapter-placeholder
  ],
  //secret: process.env.PAYLOAD_SECRET,
  secret: PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  graphQL: {
    schemaOutputFile: path.resolve(dirname, 'generated-schema.graphql'),
  },
  csrf: [
    // Add your frontend URL here
    process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'https://host.plasmicdev.com',
    'https://koblich-chronicles-fe-3g6s-leos-mikulkas-projects.vercel.app',
    'https://koblich-chronicles-fe-3g6s.vercel.app',
    'https://www.koblich-chronicles.com',
  ],
  jobs: {
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${process.env.CRON_SECRET}`
      },
    },
    tasks: [],
  },
})
