import { useState, useRef } from "react";
import { Upload, CloudUpload, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FileUploadProps {
  onBatchUploaded: (batchId: string) => void;
}

export default function FileUpload({ onBatchUploaded }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingOptions, setProcessingOptions] = useState({
    htmlTitle: true,
    metaDescription: true,
    domainFallback: false,
  });
  const [retryAttempts, setRetryAttempts] = useState("3");
  const [batchSize, setBatchSize] = useState("1000");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 100MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const uploadFile = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await apiRequest('POST', '/api/upload', formData);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      const result = await response.json();

      clearInterval(progressInterval);
      setUploadProgress(100);

      toast({
        title: "Upload successful",
        description: `${result.domainCount} domains uploaded successfully`,
      });

      onBatchUploaded(result.batchId);
      setSelectedFile(null);
      
      // Start processing automatically
      try {
        await apiRequest('POST', `/api/process/${result.batchId}`);
        toast({
          title: "Processing started",
          description: "Domain extraction has begun",
        });
      } catch (processError: any) {
        toast({
          title: "Processing start failed",
          description: processError.message,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Card className="bg-surface shadow-material border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <Upload className="text-primary-custom mr-2 h-5 w-5" />
          Upload Domain List
        </h2>
        <p className="text-sm text-gray-600 mt-1">Upload CSV or text files containing domains to process</p>
      </div>
      <CardContent className="p-6">
        {/* File Drop Zone */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-custom hover:bg-primary-custom hover:bg-opacity-5 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <CloudUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to browse</p>
          <p className="text-sm text-gray-600 mb-4">Supports CSV, TXT files up to 100MB</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,.txt"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <Button className="bg-primary-custom hover:bg-blue-700 text-white">
            Select Files
          </Button>
        </div>

        {/* Selected File Display */}
        {selectedFile && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-700">Selected: {selectedFile.name}</p>
            <p className="text-xs text-gray-500">Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{selectedFile?.name}</span>
              <span className="text-sm text-gray-600">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Configuration Options */}
        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Processing Options</label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="htmlTitle"
                  checked={processingOptions.htmlTitle}
                  onCheckedChange={(checked) =>
                    setProcessingOptions(prev => ({ ...prev, htmlTitle: checked as boolean }))
                  }
                />
                <label htmlFor="htmlTitle" className="text-sm text-gray-700">HTML Title Extraction</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="metaDescription"
                  checked={processingOptions.metaDescription}
                  onCheckedChange={(checked) =>
                    setProcessingOptions(prev => ({ ...prev, metaDescription: checked as boolean }))
                  }
                />
                <label htmlFor="metaDescription" className="text-sm text-gray-700">Meta Description Analysis</label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="domainFallback"
                  checked={processingOptions.domainFallback}
                  onCheckedChange={(checked) =>
                    setProcessingOptions(prev => ({ ...prev, domainFallback: checked as boolean }))
                  }
                />
                <label htmlFor="domainFallback" className="text-sm text-gray-700">Domain-based Fallback</label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retry Attempts</label>
              <Select value={retryAttempts} onValueChange={setRetryAttempts}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Size</label>
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1000</SelectItem>
                  <SelectItem value="5000">5000</SelectItem>
                  <SelectItem value="10000">10000</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={uploadFile}
            disabled={!selectedFile || isUploading}
            className="w-full bg-primary-custom hover:bg-blue-700 text-white flex items-center justify-center"
          >
            <Play className="mr-2 h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload & Queue for Processing'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
