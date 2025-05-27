from PIL import Image
import os
from pathlib import Path

def convert_feature_graphic(input_path, output_path, target_width=1024, target_height=500):
    """
    Convert an image to feature graphic format (1024x500 px)
    """
    # Open the image
    with Image.open(input_path) as img:
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Calculate dimensions while maintaining aspect ratio
        img_width, img_height = img.size
        
        # Create a new image with required dimensions
        new_img = Image.new('RGB', (target_width, target_height), (23, 20, 41))  # Dark background color
        
        # Calculate scaling factor to fit the image
        scale = min(target_width / img_width, target_height / img_height)
        new_width = int(img_width * scale)
        new_height = int(img_height * scale)
        
        # Resize the original image
        resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Calculate position to center the image
        x = (target_width - new_width) // 2
        y = (target_height - new_height) // 2
        
        # Paste the resized image onto the background
        new_img.paste(resized_img, (x, y))
        
        # Save the result with high quality
        new_img.save(output_path, 'PNG', quality=100)
        print(f"Converted image size: {new_img.size}")

if __name__ == '__main__':
    # Input image path
    input_path = r"C:\Users\sharm\Downloads\DALL·E 2025-03-27 10.25.21 - A sleek and modern fitness app feature graphic with a minimalist design. The background transitions from deep navy blue to rich purple, creating a pre (1).png"
    
    # Create output path in the same directory
    output_dir = os.path.dirname(input_path)
    output_path = os.path.join(output_dir, 'feature_graphic_1024x500.png')
    
    print('Feature Graphic Converter for Google Play Store')
    print('---------------------------------------------')
    print(f'1. Converting image: {os.path.basename(input_path)}')
    print(f'2. Output will be saved as: {os.path.basename(output_path)}')
    print('3. Converting...')
    
    try:
        convert_feature_graphic(input_path, output_path)
        print('\nConversion complete!')
        print(f'Check the file: {output_path}')
        
        # Verify the output image dimensions
        with Image.open(output_path) as img:
            width, height = img.size
            print(f'\nVerification:')
            print(f'Required dimensions: 1024x500')
            print(f'Actual dimensions: {width}x{height}')
            if (width, height) == (1024, 500):
                print('✓ Image meets Google Play Store requirements')
            else:
                print('⚠ Warning: Image dimensions do not match requirements')
                
    except Exception as e:
        print(f'\nError: {str(e)}') 