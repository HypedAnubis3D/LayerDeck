import JSZip from 'jszip';

export interface Parsed3MF {
  id: string;
  filename: string;
  file: File;
  modelName: string;
  objectsCount: number;
  printTimeEstimate?: string;
  status: 'pending' | 'parsing' | 'ready' | 'error' | 'added';
  errorMessage?: string;
}

export async function parse3MFFile(file: File): Promise<Parsed3MF> {
  const result: Parsed3MF = {
    id: crypto.randomUUID(),
    filename: file.name,
    file,
    modelName: file.name.replace(/\.3mf$/i, ''),
    objectsCount: 0,
    status: 'parsing'
  };

  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    // Look for 3D/3dmodel.model which is standard for 3MF
    const modelFile = contents.file('3D/3dmodel.model') || contents.file('Metadata/model_settings.config');
    
    if (modelFile) {
      const xmlString = await modelFile.async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      
      // Try to find object nodes to get a better name or count
      const objects = xmlDoc.getElementsByTagName('object');
      result.objectsCount = objects.length;
      
      if (objects.length > 0) {
        // Try to get the name of the first main object
        const firstObjName = objects[0].getAttribute('name');
        if (firstObjName && firstObjName.trim() !== '') {
          result.modelName = firstObjName;
        }
      }
      
      // Look for Bambu specific print time estimates if it's a Bambu sliced 3MF
      const plateData = xmlDoc.getElementsByTagName('plate');
      let totalTime = 0;
      for (let i = 0; i < plateData.length; i++) {
        const timeStr = plateData[i].getAttribute('prediction');
        if (timeStr) totalTime += parseInt(timeStr, 10);
      }
      
      if (totalTime > 0) {
        const hours = Math.floor(totalTime / 3600);
        const mins = Math.floor((totalTime % 3600) / 60);
        result.printTimeEstimate = `${hours}h ${mins}m`;
      }
    }
    
    result.status = 'ready';
  } catch (error) {
    console.error("Error parsing 3MF:", error);
    result.status = 'error';
    result.errorMessage = error instanceof Error ? error.message : "Invalid 3MF file";
  }

  return result;
}
