import React from 'react'
import { Layout } from '@layouts/AppLayout'
import { Badge } from '@components/ui/Badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@components/ui/Card'
import { appFeatures } from '@/constants/features'

export const WorkspacePage: React.FC = () => {
  return (
    <Layout title="Workspace">
      <div className="space-y-6">
        <section className="rounded-lg border border-orange-200 bg-white/70 backdrop-blur-sm p-6 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Badge variant="success">All features unlocked and free</Badge>
              <h2 className="mt-3 text-2xl font-bold text-slate-950 dark:text-white">
                OpenDocs Studio workspace
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                All tools are available to everyone. No sign-in required. Start creating, editing, and collaborating
                right away.
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {appFeatures.map((feature) => (
            <Card key={feature.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{feature.name}</CardTitle>
                    <CardDescription className="mt-2">{feature.description}</CardDescription>
                  </div>
                  <Badge variant="success">Available</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-500 dark:text-slate-400">{feature.status}</span>
                  <span className="text-slate-600 dark:text-slate-300">Free for everyone</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  )
}
