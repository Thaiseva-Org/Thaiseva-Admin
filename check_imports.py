
import os
import re

def check_imports(root_dir):
    error_files = []
    # Components to check for.
    components = ['TextField', 'Button', 'Box', 'Grid', 'Typography', 'IconButton']
    
    for dirpath, _, filenames in os.walk(root_dir):
        for filename in filenames:
            if filename.endswith('.jsx') or filename.endswith('.js') or filename.endswith('.tsx'):
                filepath = os.path.join(dirpath, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    for comp in components:
                        # Check if component is used (heuristic: <Component)
                        if re.search(r'<' + comp + r'\b', content):
                            # Check if imported
                            if not re.search(r'import\s+.*' + comp + r'.*', content):
                                error_files.append((filepath, comp))
                except Exception as e:
                    pass

    return error_files

if __name__ == "__main__":
    src_dir = os.path.join(os.getcwd(), 'src')
    errors = check_imports(src_dir)
    with open('import_errors_utf8.txt', 'w', encoding='utf-8') as f:
        if errors:
            f.write("Possible missing imports found:\n")
            for path, comp in errors:
                f.write(f"{path}: Missing import for {comp}\n")
        else:
            f.write("No obvious missing imports found for checked components.\n")
