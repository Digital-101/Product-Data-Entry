const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

const dataFile = path.join(__dirname, 'Gui_data.csv');

// Create the Electron Window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Make sure to set this to false for simple applications
    },
  });

  win.loadFile('index.html');
}

// Handle app initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Handle data submission from the renderer
ipcMain.on('submit-data', (event, data) => {
  const { productName, costPrice, sellPrice, month, region, profitLoss } = data;

  const headers = ["Product", "Cost", "Sell", "Month", "Region", "Profit/Loss"];
  const fileExists = fs.existsSync(dataFile);

  // Append to CSV file
  const writeStream = fs.createWriteStream(dataFile, { flags: 'a' });
  if (!fileExists) {
    writeStream.write(headers.join(',') + '\n');
  }
  writeStream.write([productName, costPrice, sellPrice, month, region, profitLoss].join(',') + '\n');
  writeStream.end();

  dialog.showMessageBox({
    type: 'info',
    message: `Data saved successfully in ${dataFile}`,
  });
});

// Visualize data
ipcMain.on('visualize-data', (event) => {
  if (!fs.existsSync(dataFile)) {
    dialog.showErrorBox("File Error", "Data file does not exist.");
    return;
  }

  const chartData = {
    labels: [],
    datasets: []
  };

  const productsData = {}; // Store data for products
  const regionsData = {};  // Store data for regions
  const monthsSet = new Set();  // Track unique months

  fs.createReadStream(dataFile)
    .pipe(csvParser())
    .on('data', (row) => {
      const { Product, Month, 'Profit/Loss': profitLoss, Region } = row;

      // Add month to the months set
      monthsSet.add(Month);

      // Group data by Product and Region
      if (!productsData[Product]) productsData[Product] = {};
      if (!regionsData[Region]) regionsData[Region] = {};

      productsData[Product][Month] = (productsData[Product][Month] || 0) + parseFloat(profitLoss);
      regionsData[Region][Month] = (regionsData[Region][Month] || 0) + parseFloat(profitLoss);
    })
    .on('end', () => {
      // Convert Set to array and sort months
      const months = [...monthsSet].sort();

      chartData.labels = months;

      // Prepare datasets for chart visualization
      chartData.datasets = [
        {
          label: 'Product Profit/Loss',
          data: months.map(month => {
            return Object.keys(productsData).map(product => productsData[product][month] || 0);
          }).flat(),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1,
        },
        {
          label: 'Region Profit/Loss',
          data: months.map(month => {
            return Object.keys(regionsData).map(region => regionsData[region][month] || 0);
          }).flat(),
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1,
        }
      ];

      event.sender.send('visualize-data-response', chartData);
    });
});
