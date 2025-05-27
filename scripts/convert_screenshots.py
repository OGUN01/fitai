from PIL import Image
import os
from pathlib import Path

def create_tablet_screenshot(input_path, output_path, target_width=1920, target_height=1080):
    """
    Convert a phone screenshot to tablet format with 16:9 aspect ratio
    """
    # Open the image
    with Image.open(input_path) as img:
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Calculate dimensions while maintaining aspect ratio
        img_width, img_height = img.size
        
        # Create a new image with 16:9 aspect ratio and black background
        new_img = Image.new('RGB', (target_width, target_height), (23, 20, 41))  # Dark background color
        
        # Calculate scaling factor to fit the phone screenshot
        scale = min(target_width * 0.8 / img_width, target_height * 0.9 / img_height)
        new_width = int(img_width * scale)
        new_height = int(img_height * scale)
        
        # Resize the original image
        resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Calculate position to center the image
        x = (target_width - new_width) // 2
        y = (target_height - new_height) // 2
        
        # Paste the resized image onto the background
        new_img.paste(resized_img, (x, y))
        
        # Save the result
        new_img.save(output_path, 'PNG', quality=95)

def process_screenshots(input_folder, output_folder='tablet_screenshots'):
    """
    Process all images in the input folder and save converted versions to output folder
    """
    # Create output folder if it doesn't exist
    Path(output_folder).mkdir(parents=True, exist_ok=True)
    
    # Process each image in the input folder
    for filename in os.listdir(input_folder):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg')):
            input_path = os.path.join(input_folder, filename)
            output_path = os.path.join(output_folder, f'tablet_{filename.rsplit(".", 1)[0]}.png')
            
            try:
                print(f'Converting {filename}...')
                create_tablet_screenshot(input_path, output_path)
                print(f'Successfully converted {filename}')
            except Exception as e:
                print(f'Error converting {filename}: {str(e)}')

if __name__ == '__main__':
    # Use your specific screenshot location
    input_folder = r"C:\Users\sharm\OneDrive\Desktop\app"
    output_folder = os.path.join(input_folder, "tablet_screenshots")
    
    print('Screenshot Converter for Google Play Store')
    print('----------------------------------------')
    print(f'1. Reading screenshots from: {input_folder}')
    print(f'2. Converted images will be saved in: {output_folder}')
    print('3. Converting...')
    
    process_screenshots(input_folder, output_folder)
    
    print('\nConversion complete!')
    print(f'Check the folder: {output_folder} for your converted images.') 