import { useEffect } from 'react';

const Index = () => {
  useEffect(() => { document.title = 'Podcast Fit Rater'; }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Podcast Fit Rater</h1>
        <p className="text-xl text-muted-foreground">This route has moved. Use the Evaluate tab.</p>
        <a href="/" className="underline">Go to Evaluate</a>
      </div>
    </div>
  );
};

export default Index;
