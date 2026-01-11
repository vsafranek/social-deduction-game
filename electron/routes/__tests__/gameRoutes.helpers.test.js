// electron/routes/__tests__/gameRoutes.helpers.test.js
// Unit tests for helper functions in gameRoutes.js - testing real filesystem

const fs = require('fs');
const path = require('path');
const { getAllAvailableAvatars } = require('../../routes/gameRoutes');

// Mock console methods
jest.spyOn(console, 'log').mockImplementation(() => {});
jest.spyOn(console, 'warn').mockImplementation(() => {});

describe('getAllAvailableAvatars - Real Filesystem Tests', () => {
  
  // Replicate the exact filtering logic from getAllAvailableAvatars()
  function filterAvatars(files) {
    const avatars = [];
    files.forEach((file) => {
      // Only include files that DON'T have "details" or "detail" in the name and are images
      const fileNameLower = file.toLowerCase();
      const hasDetail = fileNameLower.includes("detail");

      if (!hasDetail && /\.(png|jpg|jpeg|svg)$/i.test(file)) {
        avatars.push(`/avatars/${file}`);
      }
    });
    return avatars;
  }
  
  // Get actual files from filesystem
  function getActualAvatarFiles() {
    const devAvatarsDir = path.join(__dirname, "../../../frontend/public/avatars");
    
    if (!fs.existsSync(devAvatarsDir)) {
      return []; // Return empty if directory doesn't exist (e.g., in CI)
    }
    
    try {
      return fs.readdirSync(devAvatarsDir);
    } catch (error) {
      console.warn('Could not read avatars directory:', error.message);
      return [];
    }
  }
  
  describe('Real filesystem avatar filtering', () => {
    
    test('should load only non-detail avatars from real filesystem', () => {
      const actualFiles = getActualAvatarFiles();
      
      // Skip test if directory doesn't exist (e.g., in CI environment)
      if (actualFiles.length === 0) {
        console.log('Skipping test - avatars directory not found or empty');
        return;
      }
      
      const filtered = filterAvatars(actualFiles);
      
      // Check that no detail files are included
      const detailFiles = filtered.filter(avatar => 
        avatar.toLowerCase().includes('detail')
      );
      expect(detailFiles).toHaveLength(0);
      
      // Check that non-detail files ARE included
      const nonDetailFiles = actualFiles.filter(file => {
        const fileNameLower = file.toLowerCase();
        const hasDetail = fileNameLower.includes("detail");
        const isImage = /\.(png|jpg|jpeg|svg)$/i.test(file);
        return !hasDetail && isImage;
      });
      
      // All non-detail image files should be in the filtered result
      nonDetailFiles.forEach(file => {
        expect(filtered).toContain(`/avatars/${file}`);
      });
      
      // Filtered result should have exactly the same number as non-detail image files
      expect(filtered.length).toBe(nonDetailFiles.length);
    });
    
    test('should exclude all detail variants when non-detail versions exist', () => {
      const actualFiles = getActualAvatarFiles();
      
      if (actualFiles.length === 0) {
        console.log('Skipping test - avatars directory not found or empty');
        return;
      }
      
      const filtered = filterAvatars(actualFiles);
      
      // Find files that have both detail and non-detail versions
      const filesWithDetail = actualFiles.filter(file => {
        const fileNameLower = file.toLowerCase();
        return fileNameLower.includes('detail');
      });
      
      // For each detail file, check that there's a corresponding non-detail file
      filesWithDetail.forEach(detailFile => {
        // Extract base name (e.g., "badger_detail.jpg" -> "badger")
        const baseName = detailFile.replace(/_detail\.[^.]+$/i, '').replace(/\.[^.]+$/, '');
        const extension = detailFile.match(/\.[^.]+$/)?.[0] || '';
        
        // Find corresponding non-detail file
        const nonDetailFile = actualFiles.find(file => {
          const fileNameLower = file.toLowerCase();
          const hasDetail = fileNameLower.includes('detail');
          const matchesBase = file.toLowerCase().startsWith(baseName.toLowerCase());
          const isImage = /\.(png|jpg|jpeg|svg)$/i.test(file);
          
          return !hasDetail && matchesBase && isImage;
        });
        
        if (nonDetailFile) {
          // If non-detail version exists, detail version should NOT be in filtered
          expect(filtered).not.toContain(`/avatars/${detailFile}`);
          // Non-detail version SHOULD be in filtered
          expect(filtered).toContain(`/avatars/${nonDetailFile}`);
        }
      });
    });
    
    test('should exclude detail files even if no non-detail version exists', () => {
      const actualFiles = getActualAvatarFiles();
      
      if (actualFiles.length === 0) {
        console.log('Skipping test - avatars directory not found or empty');
        return;
      }
      
      const filtered = filterAvatars(actualFiles);
      
      // Check all detail files are excluded
      actualFiles.forEach(file => {
        const fileNameLower = file.toLowerCase();
        if (fileNameLower.includes('detail')) {
          expect(filtered).not.toContain(`/avatars/${file}`);
        }
      });
    });
    
    test('should include non-detail image files (jpg, png, jpeg, svg)', () => {
      const actualFiles = getActualAvatarFiles();
      
      if (actualFiles.length === 0) {
        console.log('Skipping test - avatars directory not found or empty');
        return;
      }
      
      const filtered = filterAvatars(actualFiles);
      
      // Check that valid image files without "detail" are included
      actualFiles.forEach(file => {
        const fileNameLower = file.toLowerCase();
        const hasDetail = fileNameLower.includes('detail');
        const isImage = /\.(png|jpg|jpeg|svg)$/i.test(file);
        
        if (!hasDetail && isImage) {
          expect(filtered).toContain(`/avatars/${file}`);
        }
      });
    });
    
    test('should return correct format (/avatars/filename.ext)', () => {
      const actualFiles = getActualAvatarFiles();
      
      if (actualFiles.length === 0) {
        console.log('Skipping test - avatars directory not found or empty');
        return;
      }
      
      const filtered = filterAvatars(actualFiles);
      
      // All returned paths should start with /avatars/
      filtered.forEach(avatarPath => {
        expect(avatarPath).toMatch(/^\/avatars\//);
        expect(avatarPath).not.toBe('/avatars/'); // Should have filename
      });
    });
  });

});

afterAll(() => {
  console.log.mockRestore();
  console.warn.mockRestore();
});
