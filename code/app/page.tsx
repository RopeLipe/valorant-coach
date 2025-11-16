import { DesktopApp } from "@/components/desktop-app"
import { InGameOverlay } from "@/components/in-game-overlay"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <div className="mb-8 text-center animate-fade-in-up">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Valorant AI Coach</h1>
          <p className="text-muted-foreground">Preview of In-Game Overlay & Desktop App</p>
        </div>

        <Tabs defaultValue="overlay" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="overlay">In-Game Overlay</TabsTrigger>
            <TabsTrigger value="desktop">Desktop App</TabsTrigger>
          </TabsList>

          <TabsContent value="overlay" className="animate-fade-in-up">
            <InGameOverlay />
          </TabsContent>

          <TabsContent value="desktop" className="animate-fade-in-up">
            <DesktopApp />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
