// client/src/utils/chartWorker.ts

self.onmessage = (event: MessageEvent) => {
    const rawData = event.data;

    if (!rawData || !Array.isArray(rawData)) {
        self.postMessage([]);
        return;
    }

    const processedData = rawData.map((item) => {
        return {
            name: item.featureName || 'Unknown',
            value: item.impactScore ? Number(item.impactScore.toFixed(2)) : 0,
        };
    });

    self.postMessage(processedData);
};
