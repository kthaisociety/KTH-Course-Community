export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-12 pt-32">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-8 text-center">
            About KTH Course Community
          </h1>

          <div className="prose prose-lg max-w-none">
            <div className="bg-card p-8 rounded-lg shadow-sm border border-border mb-8">
              <h2 className="text-2xl font-semibold text-card-foreground mb-4">
                Our Mission
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                KTH Course Community is dedicated to helping KTH students
                navigate their academic journey. By collecting and sharing
                honest student reviews, we provide an overview of course
                content, workload, and learning experiences.
              </p>
            </div>

            <div className="bg-card p-8 rounded-lg shadow-sm border border-border mb-8">
              <h2 className="text-2xl font-semibold text-card-foreground mb-4">
                How It Works
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Students are able to share their experiences and insights about
                courses they've taken at KTH. These reviews help future students
                make informed decisions about their course selections.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  Browse comprehensive course reviews from fellow students
                </li>
                <li>
                  Learn about course difficulty, workload, and teaching quality
                </li>
                <li>Make better-informed decisions about your academic path</li>
                <li>Contribute your own experiences to help others</li>
              </ul>
            </div>

            <div className="bg-card p-8 rounded-lg shadow-sm border border-border">
              <h2 className="text-2xl font-semibold text-card-foreground mb-4">
                Our Values
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We believe in transparency, community, and student empowerment.
                Every review on KTH Course Community is written by students, for
                students. We're committed to maintaining an honest and helpful
                platform that serves the KTH community. If you are interested in
                contributing with new features or fixes for this platform you
                are very welcome to do so via the officialt KTH Course Community
                GitHub!
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
