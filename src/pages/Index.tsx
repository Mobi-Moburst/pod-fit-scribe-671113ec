import { useEffect } from 'react';

const Index = () => {
  useEffect(() => { document.title = 'Kitcaster Campaign Command Center'; }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Kitcaster Campaign Command Center</h1>
        <p className="text-xl text-muted-foreground">This route has moved. Use the Evaluate tab.</p>
        <a href="/" className="underline">Go to Evaluate</a>
      </div>
    </div>
  );
};

export default Index;
