
import React, { useState, useCallback, useEffect } from 'react';
import { ProductIdea, FullProduct, AppPhase, SavedProductItem } from './types';
import { generateProductIdea, buildFullProduct } from './services/geminiService';
import { Button } from './components/Button';
import { IdeaCard } from './components/IdeaCard';
import { ProductDetailsView } from './components/ProductDetailsView';
import { LoadingSpinner } from './components/LoadingSpinner';
import { Modal } from './components/Modal';
import { Header } from './components/Header';
import { SavedProductsList } from './components/SavedProductsList'; 

const ENV_API_KEY = process.env.API_KEY; 
const LOCAL_STORAGE_KEY = 'digitalProductGenerator_savedProducts';

const App: React.FC = () => {
  const [currentPhase, setCurrentPhase] = useState<AppPhase>(AppPhase.Initial);
  const [currentIdea, setCurrentIdea] = useState<ProductIdea | null>(null);
  const [generatedProduct, setGeneratedProduct] = useState<FullProduct | SavedProductItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isGeneratingIdea, setIsGeneratingIdea] = useState<boolean>(false);
  const [isBuildingProduct, setIsBuildingProduct] = useState<boolean>(false);
  
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptModalContent, setScriptModalContent] = useState<{ title: string; script: string } | null>(null);
  const [apiKeyMissingError, setApiKeyMissingError] = useState<boolean>(false);

  const [savedProducts, setSavedProducts] = useState<SavedProductItem[]>([]);

  useEffect(() => {
    if (!ENV_API_KEY) {
      setError("API Key is missing. Please ensure the API_KEY environment variable is set.");
      setApiKeyMissingError(true);
      setCurrentPhase(AppPhase.Initial); 
    } else {
      setApiKeyMissingError(false);
    }
    
    try {
      const storedProducts = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedProducts) {
        setSavedProducts(JSON.parse(storedProducts));
      }
    } catch (e) {
      console.error("Failed to load saved products from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(savedProducts));
    } catch (e) {
      console.error("Failed to save products to localStorage:", e);
       setError("Could not save product. Your browser's storage might be full or disabled.");
    }
  }, [savedProducts]);


  const handleGenerateIdea = useCallback(async () => {
    if (!ENV_API_KEY) { 
      setError("API Key is missing. Cannot generate ideas.");
      setApiKeyMissingError(true);
      return;
    }
    setError(null);
    setGeneratedProduct(null); // Always clear previous product when generating a new idea
    
    setIsGeneratingIdea(true);

    try {
      const idea = await generateProductIdea(); 
      if (idea) {
        setCurrentIdea(idea);
        setCurrentPhase(AppPhase.IdeaGeneration);
      } else {
        setError("Failed to generate a valid idea. The AI returned an unexpected format. Please try again.");
        setCurrentIdea(null); // Ensure currentIdea is null if generation failed
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred during idea generation. Please try again.");
      setCurrentIdea(null);
    } finally {
      setIsGeneratingIdea(false);
    }
  }, []); 

  const handleApproveIdea = useCallback(async () => {
    if (!currentIdea) {
      setError("No idea to approve.");
      return;
    }
    if (!ENV_API_KEY) { 
      setError("API Key is missing. Cannot build product.");
      setApiKeyMissingError(true);
      return;
    }
    setError(null);
    setIsBuildingProduct(true);
    setCurrentPhase(AppPhase.ProductBuilding); // Set phase before async call
    try {
      const product = await buildFullProduct(currentIdea); 
      if (product) {
        setGeneratedProduct(product);
        setCurrentPhase(AppPhase.ProductView);
      } else {
        setError("Failed to generate the full product. The AI returned an unexpected format or incomplete data. Please try approving the idea again or generate a new one.");
        setCurrentPhase(AppPhase.IdeaGeneration); 
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while building the product. Please try again.");
      setCurrentPhase(AppPhase.IdeaGeneration); 
    } finally {
      setIsBuildingProduct(false);
    }
  }, [currentIdea]); 

  const handleViewScript = (script: string, title: string) => {
    setScriptModalContent({ script, title });
    setShowScriptModal(true);
  };
  
  const handleStartOver = () => {
    setCurrentIdea(null);
    setGeneratedProduct(null);
    setError(null);
    setCurrentPhase(AppPhase.Initial);
     if (!ENV_API_KEY) {
        setApiKeyMissingError(true);
        setError("API Key is missing. Please ensure the API_KEY environment variable is set.");
    } else {
        setApiKeyMissingError(false);
    }
  };

  const handleNavigateHome = () => {
    if (currentPhase === AppPhase.SavedProductsView) {
       setCurrentPhase(AppPhase.Initial);
    } else if (currentPhase !== AppPhase.IdeaGeneration && currentPhase !== AppPhase.ProductView) {
       setCurrentPhase(AppPhase.Initial);
    }
    // If on ProductView or IdeaGeneration, clicking logo keeps user on the current view.
  };

  const handleNavigateToSavedProducts = () => {
    setCurrentPhase(AppPhase.SavedProductsView);
  };

  const handleSaveCurrentProduct = () => {
    if (generatedProduct && !('id' in generatedProduct && savedProducts.some(p => p.id === (generatedProduct as SavedProductItem).id))) {
      const newSavedProduct: SavedProductItem = {
        ...generatedProduct,
        id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        savedAt: new Date().toISOString(),
      };
      setSavedProducts(prev => [newSavedProduct, ...prev]);
      setGeneratedProduct(newSavedProduct); // Update current product to be the saved version with ID
    }
  };

  const handleDeleteSavedProduct = (productId: string) => {
    setSavedProducts(prev => prev.filter(p => p.id !== productId));
    if (generatedProduct && 'id' in generatedProduct && (generatedProduct as SavedProductItem).id === productId) {
      // If the currently viewed product is deleted, revert it to a non-saved state (remove id, savedAt)
      const { id, savedAt, ...restOfProduct } = generatedProduct as SavedProductItem;
      setGeneratedProduct(restOfProduct as FullProduct);
    }
  };

  const handleViewSavedProduct = (product: SavedProductItem) => {
    setGeneratedProduct(product);
    setCurrentIdea(null); // Clear any lingering idea if viewing a fully saved product
    setCurrentPhase(AppPhase.ProductView);
  };

  const handleRetryAfterError = () => {
    setError(null);
    if (currentIdea && (!generatedProduct || currentPhase === AppPhase.ProductBuilding || (currentPhase === AppPhase.IdeaGeneration && generatedProduct === null) )) {
      // If we have an idea, and product build failed (generatedProduct is null or we got stuck in ProductBuilding phase)
      // Or if we are in IdeaGeneration (reverted from build error) with an existing idea and no product.
      handleApproveIdea();
    } else {
      // Otherwise (e.g. currentIdea is null, or some other state), try to generate a new idea.
      setCurrentIdea(null); 
      setGeneratedProduct(null);
      // Don't set phase to Initial here, handleGenerateIdea will transition from current state.
      handleGenerateIdea(); 
    }
  };

  const renderContent = () => {
    if (apiKeyMissingError && !ENV_API_KEY) { 
        return (
            <div className="text-center p-8 max-w-lg mx-auto bg-white shadow-md rounded-lg border border-red-200 mt-10">
                <h2 className="text-xl font-semibold text-red-600 mb-3">Configuration Error</h2>
                <p className="text-gray-700 mb-2">The Gemini API Key is missing.</p>
                <p className="text-gray-600 text-sm">
                  Please set the <code className="bg-gray-200 text-gray-800 px-1 rounded text-xs">API_KEY</code> environment variable.
                </p>
                <p className="text-gray-500 text-xs mt-4">This app cannot function without a valid API Key.</p>
            </div>
        );
    }

    if (isGeneratingIdea) {
        return <LoadingSpinner message={currentIdea ? "Generating next product idea..." : "Generating your unique product idea..."} />;
    }
    if (isBuildingProduct) {
        return <LoadingSpinner message="Building your complete Digital Product 2.0... This can take a moment." />;
    }
    
    if (error && !apiKeyMissingError) { 
      return (
        <div className="text-center p-6 bg-red-50 border border-red-300 rounded-md max-w-xl mx-auto my-8 shadow-sm">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Oops! Something went wrong.</h2>
          <p className="text-red-600 mb-4 whitespace-pre-wrap text-sm">{error}</p>
          <Button onClick={handleRetryAfterError} variant="danger" size="sm">
            Try Again
          </Button>
        </div>
      );
    }

    switch (currentPhase) {
      case AppPhase.Initial:
        return (
          <div className="text-center py-12 sm:py-20 max-w-xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-semibold text-gray-800 mb-4">AI-Powered Product Creation</h2>
            <p className="text-gray-600 mb-8 text-lg">Instantly generate and structure unique digital product ideas. Ready to innovate?</p>
            <Button onClick={() => handleGenerateIdea()} size="lg" variant="primary" isLoading={isGeneratingIdea}>
              ✨ Generate First Product Idea
            </Button>
          </div>
        );
      case AppPhase.IdeaGeneration:
        if (currentIdea) {
          return (
            <IdeaCard 
              idea={currentIdea} 
              onApprove={handleApproveIdea} 
              onNextIdea={() => handleGenerateIdea()}
              isGeneratingNext={isGeneratingIdea} 
              isApproving={isBuildingProduct} 
            />
          );
        }
         // This case implies an error occurred if currentIdea is null, handled by error display above.
         // Or, if somehow reached without error but no idea, show loader or prompt to start.
        if(!error) return <LoadingSpinner message="Fetching new idea..."/>;
        return null; // Error display will take precedence
      case AppPhase.ProductBuilding:
        // This phase is primarily for the loading spinner, which is handled above by isBuildingProduct.
        // If somehow here without loading, it's an inconsistent state.
        return <LoadingSpinner message="Preparing to build your product..." />;
      case AppPhase.ProductView:
        if (generatedProduct) {
          const isSaved = 'id' in generatedProduct && savedProducts.some(p => p.id === (generatedProduct as SavedProductItem).id);
          return <ProductDetailsView 
                    product={generatedProduct} 
                    onViewScript={handleViewScript} 
                    onStartOver={handleStartOver}
                    onSaveProduct={handleSaveCurrentProduct}
                    isProductSaved={isSaved} 
                  />;
        }
        // Fallback if product is missing but in this phase (should be handled by error state or redirection)
        if(!error) {
            setError("Product data is missing. Please try generating again.");
            setCurrentPhase(AppPhase.IdeaGeneration); // Revert to allow re-try
        }
        return null; 
      case AppPhase.SavedProductsView:
        return <SavedProductsList
                  savedProducts={savedProducts}
                  onViewProduct={handleViewSavedProduct}
                  onDeleteProduct={handleDeleteSavedProduct}
                  onGenerateNew={handleStartOver}
                />;
      default:
        return <p className="text-center text-gray-500 mt-10">Welcome! Please click "Generate First Product Idea" to begin.</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onNavigateToSavedProducts={handleNavigateToSavedProducts} onNavigateHome={handleNavigateHome} />
      <main className="container mx-auto p-4 sm:p-6 flex-grow w-full">
        {renderContent()}
      </main>
      <Modal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        title={scriptModalContent?.title || "Video Script"}
      >
        <div className="prose prose-sm sm:prose-base max-w-none whitespace-pre-wrap text-gray-700 leading-relaxed">
          {scriptModalContent?.script}
        </div>
      </Modal>
      <footer className="text-center py-5 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-500">Powered by Gemini AI & React. Designed for Innovation.</p>
      </footer>
    </div>
  );
};

export default App;
