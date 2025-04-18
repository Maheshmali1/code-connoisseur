"""
A simple data processing module
"""

import os
import json
from typing import List, Dict, Any, Optional


class DataProcessor:
    """
    Class for processing data files
    """

    def __init__(self, data_dir: str):
        """
        Initialize the data processor
        
        Args:
            data_dir: Directory containing data files
        """
        self.data_dir = data_dir
        self.data_cache = {}

    def load_data(self, filename: str) -> Dict[str, Any]:
        """
        Load data from a JSON file
        
        Args:
            filename: Name of the file to load
            
        Returns:
            Dictionary containing the loaded data
            
        Raises:
            FileNotFoundError: If the file doesn't exist
            json.JSONDecodeError: If the file contains invalid JSON
        """
        file_path = os.path.join(self.data_dir, filename)
        
        if filename in self.data_cache:
            return self.data_cache[filename]
        
        with open(file_path, 'r') as f:
            data = json.load(f)
            self.data_cache[filename] = data
            return data

    def save_data(self, filename: str, data: Dict[str, Any]) -> None:
        """
        Save data to a JSON file
        
        Args:
            filename: Name of the file to save
            data: Data to save
        """
        file_path = os.path.join(self.data_dir, filename)
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        # Update cache
        self.data_cache[filename] = data

    def filter_data(self, data: List[Dict[str, Any]], field: str, value: Any) -> List[Dict[str, Any]]:
        """
        Filter a list of dictionaries by field value
        
        Args:
            data: List of dictionaries to filter
            field: Field to filter on
            value: Value to filter for
            
        Returns:
            Filtered list of dictionaries
        """
        return [item for item in data if item.get(field) == value]

    def sort_data(self, data: List[Dict[str, Any]], field: str, reverse: bool = False) -> List[Dict[str, Any]]:
        """
        Sort a list of dictionaries by field
        
        Args:
            data: List of dictionaries to sort
            field: Field to sort by
            reverse: Whether to sort in reverse order
            
        Returns:
            Sorted list of dictionaries
        """
        return sorted(data, key=lambda x: x.get(field), reverse=reverse)

    def clear_cache(self) -> None:
        """Clear the data cache"""
        self.data_cache = {}


def process_file(file_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Process a single data file
    
    Args:
        file_path: Path to the file to process
        output_path: Path to save the processed data (optional)
        
    Returns:
        Processed data
    """
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Process the data (example: calculate sum of values)
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and 'values' in item and isinstance(item['values'], list):
                item['sum'] = sum(item['values'])
    
    # Save processed data if output path is provided
    if output_path:
        with open(output_path, 'w') as f:
            json.dump(data, f, indent=2)
    
    return data